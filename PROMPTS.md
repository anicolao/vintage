Prompt 1: Survey Project Status

we're coming back to this project after a few weeks break and can't remembe where we are at. survey the situation and report and recommend a nex tstep

Prompt 2: Resize Document Mockups

ok this is rebased and merged onto main but hte UX_DESIGN doc has mockups that are way to visually large and ahrd to read. let's fix the markdown so that the result is more readable without modifying the mockups. put that up as a new PR

Prompt 3: Reduce Mockup Size

this is much better but still too large let's try 66% of this size and see

Prompt 4: Generate Glass Themes

OK we'd like the user to have the UX dark/light mode follow the system settings on the phone. we'd like a glassmorphic dark mode/light mode look, let's regenerate the mockups accordingly to show both styles

Prompt 5: Propose Colour Alternatives

this is much better, I don't like the purple colour, can you propose some alternatives ?

Prompt 6: Choose Terracotta Linen

let's go with terracotte & linen

Prompt 7: Write Implementation Plan

ok the PR has been merged, we now need an implementation plan in IMPLMENTATIONPLAN.md

Prompt 8: Correct Plan Filename

that's a typo in the name it should be IMPLEMENTATION_PLAN and please put this (and all work) up as a PR for review

Prompt 9: Record Verbatim Prompts

We missed a step at the start. We should be recording all of our prompts verbatim in an append only PROMPTS.md file with each prompt preceeded by Prompt N: Three word summary and then the prompt itself exactly as typed. Let's generate that file for all past prompts now, and add a precommit hook that verifies that every commit records the prompt that it goes with.
