---
title: 'Porting a Dense Electrolyte Transport Theory, Then Putting It on a GPU'
description: 'How I rebuilt the MCT-HI theory of conduction and diffusion in strong electrolytes in Python, validated it to near rounding against the reference C++ code, evaluated its self-consistent scheme for the first time, and turned a single-system solver into a JAX-batched parameter-space instrument on an A100.'
pubDate: 2026-05-12
tags: ['Physics', 'Computational Physics', 'Electrolytes', 'JAX', 'Open Source']
---

Ask a chemist how well a given salt solution conducts electricity and they will quote you a number. Ask a physicist to predict that number from first principles, with no fitted parameters, and you have a genuinely hard problem. The ions do not move independently. Each one drags the solvent, and through the solvent it drags every other ion, and on top of that hydrodynamic coupling there is the bare Coulomb interaction, which is long ranged and does not politely decay the way a Lennard-Jones tail does. The theory that takes all of this seriously is the mode-coupling theory of hydrodynamically interacting ions, MCT-HI, developed by Contreras-Aburto and Naegele (*J. Chem. Phys.* **139**, 134109 and 134110, 2013). This post is about [pymcthi](https://github.com/), the project where I ported that theory to Python, validated it against the authors' own C++ code, evaluated a piece of it that had never been evaluated, and then made it run thousands of times in parallel on a GPU.

## Why ion transport resists a clean answer

The observable most people care about is the molar conductivity $\Lambda$, or equivalently the electrical conductivity $\sigma$. In the ideal, infinitely dilute limit you get the Nernst-Einstein value: each ion contributes independently in proportion to its free diffusion coefficient $D_0$. Real solutions always conduct less than that, and the deficit grows with concentration. Two physical effects account for it.

The first is the relaxation effect. A moving ion carries an atmosphere of oppositely charged neighbors. That atmosphere cannot rearrange instantly, so it lags behind and pulls back on the ion, a retarding force set by how fast the surrounding charge density relaxes. The second is the electrophoretic effect, which is purely hydrodynamic: the countercharge in the atmosphere is being pushed the other way by the same field, and it entrains solvent that flows backward past the central ion. MCT-HI is the machinery that computes both of these from the static structure of the fluid and its hydrodynamics, without any empirical friction coefficient bolted on.

Concretely, pymcthi computes the mobility matrix $\mu$, splits it into a short-time part and a relaxation correction, and from there produces the self-diffusion coefficients $D^L_\alpha$ (the long-time diffusion of a tagged ion of species $\alpha$), the electrical conductivity $\sigma$, and the reduced molar conductivity $\Lambda/\Lambda_0$. The relaxation correction has the schematic structure

$$\Delta\mu = -\, m^{\text{c,irr}} \left( \mathbb{1} + H^{-1} m^{\text{c,irr}} \right)^{-1} / k_B T,$$

where $m^{\text{c,irr}}$ is the time-integrated irreducible memory function and $H(q)$ is the hydrodynamic function. All of the hard physics lives inside $m^{\text{c,irr}}$.

## What the memory function actually is

The memory function is a double integral, over wavenumber $q$ and over time $t$, of products of the partial static structure factors $S(q)$, the direct correlation functions $C(q) = \mathbb{1} - S^{-1}(q)$, and the intermediate scattering function $F(q,t)$. In the published scheme $F(q,t)$ is propagated from a matrix rate

$$F(q,t) = V \, e^{-\Lambda_R t} \, V^{-1} S(q), \qquad R(q) = q^2 H(q) S^{-1}(q),$$

with $\Lambda_R$ and $V$ the eigenvalues and eigenvectors of $R(q)$ at each wavenumber. For a binary salt these are $2 \times 2$ eigenproblems, one per $q$ point, and the whole memory integral is then a sum over normal modes of terms like $F \cdot (C F C) - (C F) \cdot (F C)$, weighted by $q^4$ and integrated.

None of that is conceptually mysterious. What makes it hard to get right is the numerics. The $q$ grid is nonuniform and stretches down to $10^{-4}$ so that the small-$q$ behavior can be extrapolated under the electroneutrality constraint $\sum_i n_i z_i \tilde h_{ij}(0) = -z_j$, which is perfect screening written as a boundary condition on the fit. The Fourier transforms of $g(r)$ start from ionic contact and have to be done on the same spline quadrature the reference code uses, or the results drift in the sixth digit and you can never tell whether a discrepancy is a bug or a rounding artifact.

## Porting a theory is a validation exercise, not a translation exercise

I did not treat the C++ reference ([SMCTHIs](https://github.com/clcontreras/SMCTHIs)) as documentation. I treated it as an oracle. The port reproduces every stage and gets checked against reference files the C++ binary produced on its bundled 2:2 electrolyte example: the sine transform of $g(r)$, the constrained small-$q$ extrapolation, $S(q)$, $C(q)$, $H(q)$, the memory function, and the transport coefficients. The static and hydrodynamic quantities agree to about $5\times 10^{-12}$ relative. The memory function and molar conductivity match the six-digit reference printout. The whole thing is an eleven-test suite that runs under pytest.

The single most useful decision was reproducing the quadrature exactly rather than substituting a nicer one. SMCTHIs uses GSL's Steffen spline integration with one-sided derivatives at the boundaries. I reimplemented that and verified it head to head against the library before trusting it anywhere else. There is a real lesson here: when you port a dense numerical theory, the ordinary linear algebra is the easy part. The extrapolations, the boundary derivatives, the exact grid, and the near-null singular directions of a collinear design matrix are where agreement is won or lost. I balance the columns of the even-polynomial fit and truncate at machine epsilon precisely because the extrapolated intercept is sensitive to how the almost-null directions are handled.

## The self-consistent scheme, evaluated for the first time

Here is where the project stops being a port and starts producing new physics. Paper I defines a refinement it never evaluates, saying explicitly that self-consistent calculations "will be analyzed elsewhere." That refinement replaces the short-time propagator $F(q,t)$ with a Markovian long-time form $F^M(q,t)$ whose decay is slowed by the ions' own relaxational self-diffusion. Instead of using the bare $D_0$ everywhere, you feed back the long-time self-diffusion coefficient $D^L$, computed from an MCT self-friction integral,

$$D^L_\alpha = \frac{D^S_\alpha}{1 + \delta\zeta_\alpha/\zeta^S_\alpha},$$

and iterate to a fixed point. In pymcthi I do all the time integrals analytically from the normal-mode expansion, so only the wavenumber integral stays numerical.

To have any confidence in a scheme nobody had run, I anchored it to an analytic limit. For pointlike ions with equal $D_0$ and no hydrodynamics, the self-friction integral reduces in closed form to the Debye-Falkenhagen-Onsager-Fuoss value with the coefficient $f^p = (2 - \sqrt{2})/6$. The code reproduces that limit to better than $2\times 10^{-3}$, the residual being $q$-grid truncation of a slowly decaying integrand.

The physics that came out was not what I expected, which is the good kind of result. Self-consistency slows the atmosphere, which makes the memory integrand decay more slowly, which *strengthens* the relaxation effect and *lowers* the conductivity. For NaCl at high concentration that moves the prediction away from experiment, not toward it. So the residual gap in the published scheme is not an artifact of its single-iteration approximation. The self-consistent correction makes it worse, which tells you the gap is real physics the theory is missing, not a numerical shortcut.

## Splitting the error and following it home

The NaCl example (Attard statics, stick boundary conditions, no adjustable parameters) let me do something sharper than quoting a conductivity error. I split $\sigma/\sigma_0$ into a self part, the Nernst-Einstein contribution built from $D^L$, and a cross part carrying the ion-ion correlations. Against radiotracer self-diffusion data (Passiniemi, *J. Solution Chem.* **12**, 801, 1983), which is the first experimental test of the theory's $D^L$, the self part is accurate to 0.2 to 0.5 percent below 0.05 M and the friction is underestimated by 2 to 3 percent by 0.8 M. Self-consistency *improves* $D^L$.

The decomposition at $c = 0.84$ M is the punchline: the theory misses the self part by about +2.5 percent while overestimating the cross-correlation magnitude by roughly 25 percent. Almost the entire conductivity error lives in the cross correlations, and the two errors partially cancel in $\Lambda$. Since self-consistency feeds back only self-friction, it improves the self part and slightly worsens the cross part, which is exactly why it helps $D^L$ but hurts $\Lambda$. That resolves an apparent contradiction into a single clean statement: the Markovian $F^M$ handles self correlations better than cross correlations.

## From one system to a parameter space

The NumPy pipeline solves one electrolyte at a time. To ask structural questions (which valencies, which ion sizes, which concentrations behave which way) you need thousands of solves, and that is a different instrument. I wrote a JAX version with fully analytic statics: Attard pair correlations, or the restricted-primitive-model MSA with Percus-Yevick hard-sphere and Waisman-Lebowitz electrostatic parts, plus optional Oseen point-ion hydrodynamics. A nonsymmetric eigensolver is not available on GPU, so I recast $R(q) = q^2 H S^{-1}$ as a generalized symmetric eigenproblem via a Cholesky factor of $S$, and solve the resulting $2 \times 2$ problems in closed form because cuSolver balks at very large batches of tiny matrices. Divergence is handled by poisoning unphysical $D^L \le 0$ with NaN, so a fixed point that blows up is reported as not converged instead of returning a plausible looking wrong answer. On an A100-SXM4 this runs at roughly 12,600 self-consistent fixed points per second.

The first thing the batched solver found is a divergence boundary. Without hydrodynamics the self-consistent fixed point is stable at every sampled coupling with MSA statics. Turn on Oseen hydrodynamics and it diverges above a sharp concentration boundary $c^*$, and that boundary is nearly identical (within about 10 percent) for Attard and MSA statics. The instability is hydrodynamic in origin and closure independent. Whether it signals the onset of strongly correlated ion-atmosphere dynamics or just the breakdown of far-field point-ion hydrodynamics is precisely the question finite-size Rotne-Prager hydrodynamics in the same batched solver is built to answer.

That is the arc I like about this project. A careful port bought a trustworthy foundation, evaluating the unevaluated scheme bought a real physical statement about where the theory fails, and moving to the GPU turned all of it into an instrument for mapping the theory's behavior across a parameter space nobody had charted.
