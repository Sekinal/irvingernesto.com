---
title: 'How I Taught a Computer to Read Construction Blueprints'
summary: 'A friendly tour of a project that reads steel construction drawings, finds every metal part, and names it, and the surprising lesson that the old, simple methods won.'
---

Before a big steel building goes up, someone has to read the drawings and make a list. Every beam, every column, every brace, every base plate: find it, name it, count it. Right now a person called an estimator does this by hand, page by page, and it is slow, tiring work where a single mistake can throw off a bid worth millions of dollars. So the goal of my project was simple to say: teach a computer to do that reading.

## Read the file, do not photograph the page

Here is the first clever bit, and it is worth slowing down for.

You might picture a construction drawing as an image, like a photo of a printed page. And if that were true, the computer would have to squint at the picture, guess where the letters are, and try to make out shapes. That guessing is messy and error prone.

But these drawings are not photos. They come out of design software, and inside the file the text is already real text, and the lines are already real lines, with exact positions. Think of the difference between opening a document on your computer, where you can select and copy the words instantly, versus taking a photograph of that same document printed on paper, where the words are now just a blur of pixels you have to decode. One is effortless and exact. The other is a chore full of mistakes.

My tool reads the real text and the real lines straight out of the file. No squinting, no guessing. It gets the exact words and the exact shapes for free, and it does the whole job with a tiny fraction of the computing power a photo based approach would need. That one decision made everything downstream easier.

## The old, boring method beat the fancy one

Now for the surprise. If you have heard anything about computers and learning in the last couple of years, you have heard about the big, fashionable systems, the ones that write essays and describe pictures. The obvious move was to reach for one of those.

So I ran a fair contest. I lined up the trendy modern approaches against a much older, plainer family of methods, the kind built out of simple yes or no questions stacked into what people call decision trees. Picture a game of twenty questions: is this line long or short? Is it near the edge of the grid or in the middle? Does it sit next to other similar marks? Ask enough small questions in the right order and you can sort things out remarkably well.

The plain decision tree method won. The flashy modern systems either did worse or fell apart entirely. It turns out that when the thing you are reading is neat, structured, and full of real text already, you do not need a giant brain. You need a tidy set of good questions. Sometimes the boring tool is simply the right tool.

## The biggest win came from fixing a dull mistake

This is my favorite part, because it is so unglamorous.

At one point the tool stopped getting better no matter what I tried. The instinct in this field is always to reach for something bigger and smarter. But the single largest improvement in the entire project did not come from a cleverer method at all. It came from fixing a plain, boring labeling mistake in how I was teaching the tool.

When you train a computer like this, you show it examples and tell it the right answers. I had been sloppy. For each steel part I was marking too many bits of text as its name instead of just the one that actually was its name. Once I cleaned that up, so each part had exactly one correct label, the tool leapt forward, further than any fancy method had ever pushed it.

The lesson has stuck with me. When something you built stops improving, do not assume you need a bigger, cleverer engine. Go check whether you have been teaching it wrong. In a related piece of my work, a careful audit found that almost a third of the supposedly correct answers we had been trusting were actually corrupted by a boring software bug. The problem looked like a smart machine problem. It was really a messy homework problem in disguise.

## Where it ended up

I also had to solve a harder version of the puzzle: every steel shop draws in its own personal style, and my real examples all came from one shop. To fix that I generated a big batch of fake practice drawings in many invented styles, which taught the tool to trust the shapes when it met an unfamiliar naming style. That lifted its accuracy on a new shop's drawings a great deal.

In the end the whole thing runs on the plain, unglamorous stuff: good questions, clean labels, careful practice. The exciting part was never the machinery. It is that estimators get hours of their week handed back to them.
