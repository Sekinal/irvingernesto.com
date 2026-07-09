---
title: 'How Well Does Salt Water Conduct Electricity? Harder to Predict Than You Think'
summary: 'A friendly tour of a physics project that rebuilt a hard theory of electrolytes in Python, checked it carefully, and then ran it thousands of times at once on a GPU.'
---

Dissolve table salt in water and something quietly remarkable happens. The salt breaks apart into tiny charged particles called ions, and the water becomes able to carry electricity. This is why a sports drink can conduct a small current, why a battery works, and why your nerves can send signals: all of that runs on salty, ion filled fluids. Water with dissolved salts in it has a name. It is an electrolyte.

Now a question that sounds simple and is not. If I hand you a specific recipe, so much salt, this kind of salt, at this temperature, exactly how well will it conduct electricity? You might guess you could just add up the contributions of all the ions. For a pinch of salt in a swimming pool, that almost works. But as soon as the solution gets crowded, the real answer drops well below the simple guess, and predicting that drop from scratch, with no numbers tuned to match the answer, is genuinely difficult.

## Why it is hard: the swimmers drag each other

Picture each ion as a swimmer in a pool. A swimmer does not glide through still water. They push water backward to move forward, and that moving water tugs on every other swimmer nearby. So the swimmers are never really independent. They are all stirring the same pool and feeling each other through it.

On top of that, ions are electrically charged, and charges pull and push on each other across surprisingly long distances. A positive ion likes to be surrounded by a little cloud of negative ones, its own personal entourage. When the ion tries to move, that cloud cannot keep up perfectly. It lags behind and drags on the ion like a tiny anchor. And the cloud, shoved the opposite way, carries water backward past our ion and slows it down even more.

So the true conductivity depends on a messy dance: charged swimmers, each dragging the water, each dragging their own lagging cloud, all at once. Capturing that in equations you can actually compute is the whole challenge.

## What a "theory" is here, and what porting one means

Two physicists worked out a serious set of equations for this dance about a decade ago. Call it the theory. They also wrote a computer program, in a language called C++, that turns the equations into actual numbers. It worked, but it was dense and specialized, the kind of thing only a handful of people can run or build on.

My project rebuilt that same theory from the ground up in a friendlier, more modern language, Python. Rebuilding a program in a new language has a name: porting it. But it is not just translation. A theory like this has dozens of delicate steps, and each can go subtly wrong in ways that still produce a plausible looking number. So the real work is checking.

Here is how I checked it. I treated the original C++ program as an answer key, and compared my version against it at every single stage, not just the final answer. They matched down to the last several digits, agreement so tight it is essentially the limit of what a computer can represent. That is the payoff of careful porting: not a new answer, but a version you can fully trust and easily extend, because you proved it agrees with the trusted original everywhere.

## The part nobody had ever run

Buried in the original paper was an extra refinement the authors described but never actually computed. They basically said, someone should try this more careful version later. My project is that later.

The idea is a feedback loop. In the first pass, you assume the ions move at their natural, undisturbed speed. But of course they are being slowed down, so their real speed is lower, and that lower speed changes how the whole crowd behaves, which changes the slowdown, and so on. The careful version chases this loop around until it settles on a self consistent answer, where the speed you put in matches the speed you get out.

I ran it, and the result was a pleasant surprise, because it was not what I expected. Doing the careful loop actually pushed the conductivity prediction a little further from the real measured value, not closer. That sounds like bad news, but it is genuinely useful. It tells us the gap between theory and reality is not just laziness in the original shortcut. It is a real piece of physics the theory is still missing. When I split the error into parts, the trouble turned out to live almost entirely in how the ions coordinate with each other, the cross talk between swimmers, rather than in each swimmer on its own. The careful loop improved the solo behavior and slightly worsened the coordination, which explains the whole puzzle in one clean sentence.

## Why doing it on a GPU changes the game

The rebuilt program handles one recipe at a time. That is fine for table salt, but the interesting questions are about patterns across many recipes. What happens with double charged ions? With bigger ions? Across a whole range of concentrations? Answering that means running the calculation thousands upon thousands of times.

A GPU is a chip originally built to draw video game graphics, which makes it extremely good at doing many small calculations side by side, rather than one after another. I rewrote the solver to take advantage of that. On a high end research GPU it now crunches through more than twelve thousand of these careful, looped calculations every second, so a study that would have taken ages becomes a quick sweep across the whole landscape.

And that sweep immediately found something. When I switched on the water dragging effect between ions, the calculation stayed well behaved up to a certain crowding, then broke down past a sharp threshold. That breakdown point barely changed no matter which reasonable assumptions I made about the ion clouds, which strongly suggests it comes from the water dragging itself, not from any modeling choice. Whether that is a real physical transition or just the point where a simplifying assumption stops being fair is the next thing to figure out, and the fast GPU tool is exactly what will let me figure it out.

That is the shape of the whole project. Rebuild a hard theory and prove it trustworthy, then run the part no one had run and learn where the theory truly fails, then make it fast enough to explore a whole world of recipes at once.
