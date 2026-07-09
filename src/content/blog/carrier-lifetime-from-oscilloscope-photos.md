---
title: "Carrier Lifetime from 49 Photos of an Oscilloscope"
description: "An experimental-physics project with a computer-vision twist: no numeric data ever existed, only 49 photographs of a scope screen. I taught a computer to read the decay curves off the photos, fit them, and recover the minority-carrier lifetime of a silicon solar cell."
pubDate: 2026-04-20
tags: ['Physics', 'Semiconductors', 'Computer Vision', 'Experimental', 'Open Source']
---

The whole project rests on a fact that should not have been possible to work with: there was no data. A silicon solar cell had been measured in the lab, its minority-carrier lifetime probed by photoconductive decay across a temperature sweep, and the only surviving record of the entire run was 49 photographs. Not saved waveforms, not a CSV, not a scope dump over GPIB. Forty-nine images of a Tektronix TDS 2024 screen and a Keithley 2182A nanovoltmeter, taken roughly one every 25 seconds over about 20 minutes. Every number I report below, every temperature and every microsecond of lifetime, was recovered from those pixels.

So this is two projects wearing one coat. Half of it is semiconductor physics: what photoconductive decay measures and why the lifetime falls out of an exponential tail. The other half is computer vision: turning a photograph of a glowing trace into a clean, calibrated decay curve you can actually fit. I will take the physics first, because it tells you what the pixels have to give up.

## What lifetime is, and why you decay a solar cell to get it

A solar cell works because photons knock electron-hole pairs loose. Those excess carriers are what carry current, but they do not live forever. Each one survives only until it recombines, and the mean time from generation to recombination is the minority-carrier lifetime $\tau$. It is one of the cleanest single numbers for the electronic quality of the material, because it is set by the density of defects that carriers recombine through.

Photoconductive decay measures $\tau$ about as directly as you can. Shine light on the cell and its conductivity rises as carriers pile up. Cut the light and the excess carriers recombine, so the conductivity, and the voltage proportional to it, decays back toward baseline. In this rig a laser was chopped by a mechanical fan at roughly 70 Hz, and the falling edge after each blocked pulse is the decay. If the excitation is switched off fast compared to $\tau$, the fall is a pure exponential:

$$v_o(t) = V_1 + \Delta V \, e^{-t/\tau_p}$$

The time constant $\tau_p$ of that tail is the carrier lifetime. Fit the exponential, read off $\tau$. That is the plan. The rest of the physics is a story about the word "if" in "if the excitation is switched off fast enough," and we will come back to it.

## Reading physics off a photograph

First I had to get the curve out of the image, and a photo of a scope is a hostile input. The screen is shot at an angle, so the graticule is a trapezoid, not a rectangle. The trace glows and blooms. The dim tail of the decay, which is exactly the part I need, is the faintest thing on the panel. There are two instruments in most frames plus the grey of the room. The pipeline is OpenCV and Python, managed with uv, and it runs in three stages.

**Temperature, from the Keithley.** The nanovoltmeter reads out on a bright cyan VFD, a very distinctive color against the blue-purple scope and the grey room. I threshold for bright cyan in HSV, restrict to the lower part of the frame where the meter sits, and morphologically close horizontally so the row of digits merges into one wide strip I can crop and upscale. The validation is beautiful in its simplicity: read in chronological order, the recovered temperatures climb monotonically in steps of about 0.49 degrees C with zero reversals. A thermocouple on a warming sample cannot un-warm, so a strictly monotone sequence is strong evidence the reader is correct. The run covers -49.99 to -26.51 degrees C, that is 223.2 to 246.6 K, warming at about 1.19 degrees C per minute.

**The trace, from the scope.** The TDS 2024 LCD is a vivid blue, so I segment for that hue, but a plain blue panel or the window blinds behind the bench can masquerade as a screen. Two tricks reject the impostors. The scope LCD is a 4:3 rectangle, so I filter candidate contours by aspect ratio, which kills the long strips of blind. And a real scope screen contains the cream-colored trace, so among survivors I prefer the contour whose bounding box actually contains cream pixels. Having found the screen I take its convex hull, approximate it to a quadrilateral to get four clean corners (the hull matters, because the trace and the on-screen menu carve concavities into the blue field that would otherwise corrupt the corner finding), and apply a perspective transform to rectify the trapezoid into a canonical 800 by 600 image.

Now the graticule is square, but I still need to know how many microseconds a pixel is worth. Rather than trust a fixed number, I recover it per image from the grid itself. Running a Sobel profile down the rectified graticule and autocorrelating it finds the repeat period of the grid lines, about 62.5 pixels per division. The scope was on 250 microseconds per division, so that pins the calibration at roughly 4.0 microseconds per pixel, and the fact that the grid period comes out consistent is an independent check that the rectification is honest.

Extracting the trace itself is a column walk. For each column I take the centroid of the cream-colored pixels as the trace height. The subtlety is the tail: as the decay fades, the cream drops below any fixed threshold and the hard mask loses it. So where the mask is empty I fall back to a "cream score," roughly red plus green minus twice blue, and pick the brightest cream-ish pixel within a window around the previous column's height. That continuity constraint lets the tracker follow the faint tail without jumping onto a grid line or a menu glyph. The verification overlays, where the extracted points are drawn back onto the original trace, land exactly on the glowing curve.

## Fitting the tail, and the trap in the shoulder

With 49 calibrated $(t, V)$ curves in hand, the exponential fit ought to be routine. It was not, and the reason turned out to be the most interesting physics in the project.

The measured fall is not a clean exponential. It is sigmoidal: it starts nearly flat, bends into its steepest slope partway down, and only then straightens into a decay. A pure $e^{-t/\tau}$ has its steepest slope at the very top of the fall, not in the middle, so something is rounding off the top. That rounded top is the shoulder, and it is a genuine artifact you can catch red-handed.

The cause is that "if the light switches off fast enough" caveat. A mechanical fan blade does not chop the beam instantly. Its edge takes a finite time to sweep across the laser spot, so the illumination ramps down rather than stepping down, and the measured signal is the true exponential recombination convolved with that finite optical turn-off. The convolution smears the top of the fall into the shoulder.

Here is the clean proof it is instrumental and not physics. I measure the shoulder width on every image, and it comes out at 162 plus or minus 9 microseconds and stays flat across the entire temperature sweep. A mechanical chopper cannot possibly depend on the sample's temperature. So a shoulder that is constant while $\tau$ itself changes must be the apparatus, not the recombination. The real lifetime lives in the exponential body below the shoulder.

That dictates the fit. I do not fit the whole fall. I normalize each curve to $u = (V - V_1)/\Delta V$ and fit $\ln u$ against $t$ only over the body, roughly $u \in [0.10, 0.70]$, a window that sits below the chopper shoulder and above the noise floor and is immune to how long the plateau ran. The log-linear fit is a straight line in semilog with a typical $R^2$ around 0.98 to 0.99. The lifetimes come out in the range 245 to 384 microseconds, median 319, exactly where a crystalline-silicon cell limited by Shockley-Read-Hall recombination through a defect level should sit.

## What the sweep actually reveals

The original question was $\tau(T)$: how does lifetime depend on temperature, and what does that say about the dominant recombination mechanism? The honest answer is that this dataset cannot cleanly say, and finding out why is the payoff.

Lifetime correlates only weakly with temperature, $r = 0.60$. It correlates strongly, $r = 0.91$, with the amplitude of the photo-signal, which is proportional to the injection level, the density of carriers you inject with each pulse. Worse, the run splits into two regimes with a simultaneous jump in both $\tau$ and amplitude at image 15, around the midpoint of the session, the fingerprint of someone nudging the laser power or focus mid-run. Regime A, the earlier low-injection images, sits at $\tau$ about 260 microseconds; regime B, higher injection, at about 335. Both regimes fall on a single rising $\tau$-versus-injection trend.

That is not noise, it is real physics pointing the wrong way for this experiment. In silicon, SRH lifetime genuinely depends on injection level: push more carriers in, the recombination traps saturate, and $\tau$ rises. So injection is a real knob on $\tau$, and here it moved during the run and co-varied with temperature. The two effects are entangled, which is why a single Arrhenius fit for an activation energy is worthless on this data ($R^2 = 0.41$, uninterpretable). To isolate $\tau(T)$ you would need to hold injection fixed (stable laser power and focus) and use a faster chopper so the optical turn-off is far shorter than $\tau$ and the shoulder vanishes entirely. Vary temperature and injection independently and you are doing proper temperature-and-injection-dependent lifetime spectroscopy, which is how you pull a defect's energy level and capture cross sections out.

The result I am happiest about is not the lifetime number. It is that a full quantitative dataset, 49 calibrated decay curves and a monotone temperature record, was reconstructed from nothing but photographs, and that the same photographs caught the apparatus lying about its own turn-off time. The code, the extracted traces, and a Typst report with the figures are all in the repo.
