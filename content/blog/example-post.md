---
title: Example post — what a PTC blog post looks like
date: 2026-09-03
author: William Walker PTC
blurb: A placeholder post showing the layout and every bit of formatting the blog supports. Delete this once the first real post goes up.
---
This is an example post, not PTC news. It exists so `/blog` has something on it
while the blog is being set up, and so there's one page to look at that uses every
piece of formatting the generator supports. Delete `content/blog/example-post.md`
when the first real post is ready.

Posts are markdown files in `content/blog/`. The filename becomes the URL, so this
one lives at `/blog/example-post`. To write one, copy `content/blog/_template.md`,
rename it, and fill in the frontmatter at the top.

## Headings look like this

Paragraphs are separated by a blank line. Inline formatting covers **bold**,
*italic*, `code`, and links — both [inside the site](https://williamwalkerptc.com/calendar)
and [out to somewhere else](https://www.beaverton.k12.or.us/schools/william-walker),
which open in a new tab automatically.

### A smaller heading

Lists work the way you'd expect:

- One item per line, starting with a dash
- Useful for recapping what a fundraiser paid for
- Or listing what volunteers need to bring

> Quotes get their own treatment, which is a good home for a thank-you from a
> teacher or a line from a family after an event.

Photos go in `assets/blog/<slug>/` and get dropped in on their own line. A post
with no photo at all falls back to the blue-and-green gradient you see at the top
of this page, so nothing breaks while you're waiting on pictures.

That's the whole feature set. It's a deliberate subset of markdown rather than a
full implementation, so anything fancier than what's above will come out as plain
text.
