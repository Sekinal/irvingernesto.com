---
title: "Reading Physics Off 49 Photos of a Screen"
summary: "The only record of a whole physics experiment was 49 phone-style photos of an oscilloscope. So I taught a computer to read the curves off the photos, like reading a heart monitor from a picture, and recovered the numbers no one had saved."
---

Here is the strange situation I walked into. A physics experiment had been run on a solar cell, measuring how good the cell was over and over as it slowly warmed up. And when it was time to look at the results, there were no results. No spreadsheet, no saved data, nothing to plot. The entire record was 49 photographs. Just pictures of the lab screens, one every 25 seconds or so, like snapshots off a phone. Every number I needed was locked inside those photos as glowing shapes.

So the project became two things at once. Part of it was the physics of how solar cells work. The other part was teaching a computer to read the photos, the way you can glance at a picture of a hospital heart monitor and still see the heartbeat even though you were never in the room.

## What the experiment was really about

A solar cell works because light knocks tiny electric charges loose inside it. Sunlight hits the material, and out pop little free charges that can flow as electricity. That is the whole trick of a solar panel.

But those loose charges do not last. Almost as soon as they appear, they start finding each other again and canceling out, like sparks fizzling. Each charge survives only a tiny fraction of a second before it fizzles, and that survival time has a name: the lifetime. It is one of the most important numbers about a solar cell, because the longer the charges live, the more of them you collect as electricity, and the better the cell. A cell full of flaws fizzles its charges fast. A clean, high-quality cell holds onto them longer.

So how do you measure something that survives less than a thousandth of a second? You flash a light at the cell and watch how fast the glow fades. When light shines on it, the cell fills up with loose charges and, in effect, "glows" electrically: it conducts better. The instant you cut the light, the charges fizzle out and that glow fades. Fast fade means short lifetime. Slow fade means long lifetime.

In this lab they did exactly that. They shone a laser on the cell and used a spinning fan blade to chop the beam on and off dozens of times a second, flash, flash, flash. Each time the blade blocked the beam, the glow faded, and that fading curve is what you want to measure. They watched it on an oscilloscope, a screen that draws a wiggling line showing how a signal rises and falls over time. Every fade shows up as a little downward slope.

## The part where the data did not exist

And that is where the trouble started, because nobody saved the wiggling lines as data. All that survived was 49 photos of the oscilloscope screen with the glowing curve on it, plus a second little display showing the temperature of the cell at that moment. The physics was all there, sitting in the photos. It just was not in any form a computer could add up.

So I taught a computer to read the photos.

This is harder than it sounds, because a photo of a screen is a mess. The picture is taken at a slight angle, so the screen is a lopsided trapezoid instead of a neat rectangle. The glowing line blooms and smears. And the most important part of each curve, the very end of the fade, is also the dimmest, faintest part, the hardest thing in the whole picture to see.

The computer handles it in steps. First it hunts for the temperature display, which glows a distinctive cyan blue, and reads the number. I knew this was working because the temperatures came out in a perfectly smooth, steadily rising order, exactly what you expect from something slowly warming up. If the reading had been sloppy, the numbers would have jumped around. They did not.

Then it finds the oscilloscope screen by its vivid blue color, locates the four corners, and digitally straightens that lopsided trapezoid back into a clean rectangle, the way you might straighten a photo of a document shot at an angle. The screen has a background grid printed on it, like graph paper, and by measuring the grid spacing the computer works out how much time each step across the screen is worth. Finally it walks across the picture and traces the glowing curve, dot by dot. For the faint dying tail, where the glow almost disappears, it leans on the fact that the curve cannot suddenly jump, so it keeps following gently from where it just was. When you draw the computer's traced dots back on the real photo, they land right on the glowing line.

## The little mystery hiding in the curves

There was one lovely twist. The fading curves did not fade the way pure physics says they should. Instead of dropping fastest right at the top, each one started with a soft, rounded shoulder before it got going, as if the fade hesitated for a moment.

The culprit was the spinning fan blade. It does not block the laser instantly. Its edge takes a brief moment to sweep across the beam, so the light dims gradually instead of snapping off, and that gentle dimming smears a little rounded shoulder onto the top of every curve. I could prove it was the fan and not the cell: that shoulder was exactly the same width in all 49 photos, even as the cell warmed up and its real behavior changed. A fan blade does not care how warm the cell is. Something that stays fixed while everything else changes is the equipment, not the physics. So I simply measured the true fade from the clean part of the curve below the shoulder.

In the end I got what nobody had saved: a full set of numbers, 49 measured fade curves and 49 temperatures, all reconstructed from photographs alone. The lifetime of the charges in this silicon cell came out to a few hundred millionths of a second, right where a decent solar cell should land. And the photos even caught the equipment quietly fibbing about how fast its own shutter closed. Not bad for a pile of pictures of a screen.
