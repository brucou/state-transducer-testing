# Now
- towards v1.0
    - test also testFSM can't find where it is tested. or is it a function whose name has changed??
    - contracts to implement
    - put testing into other .md dedicated to testing and update that by the way
    - review code quality (less important)
  - test wise, would be good to generate tests starting from a target not INIT and some initial 
state at that target (cf. previous) 
  - maybe write a generator like with jsverify. cf. https://github.com/jsverify/jsverify#types 
    - seems like shrinking in our case is easy, just remove one input from the failing sequence
- DOC the generator state in the testing generator
- test new version with iterator of graph-adt 0.8.1!
- DOC if outputs wants to output an array as outputs how to do it : [Array]! DOC it
- think about using the test generator for proprty-based testing
  - for instance any valid test case must respect invariant : no invalid input
    - that might have found the bug we found
  - if no review, all ABOUT inputs in the last domain action must be found in the last ABOUT
    continue event data
  - if no review, all QUESTION inputs in the last domain action must be found in the last ABOUT
    continue event data
  - if review, all reviewed ABOUT inputs in the last domain action must be found in the last
    ABOUT continue event data
  - if review, all reviewed QUESTION inputs in the last domain action must be found in the last
    ABOUT continue event data
  - must be as many domain action as continue button click
  - etc.
- !! all-transitions is all-path-with-no-repeated-transitions which is a all-transition but
bigger, call it all-transitions* ?? to avoid changing everything
- there can be error when generating the inputs!! typically when it is done wrong, and th
emachine is not in sync with the gen. Should identify that early and return a warning? Generally
error is ...[0] is undefined. That means an event was sent and could not be handleed by the state
 machine
- input generation
  - write DOC
- ROADMAP : targetless events : NO only serves to confuse readability
      // NOTE : we implemented it here by repeating the self-loop corresponding to the targetless event in all substates

# Trivia
- example of game state machine (tetris) : https://www.colinfahey.com/tetris/tetris.html?utm_source=ponyfoo+weekly&utm_medium=email&utm_campaign=146

#testing
The FSM can be used to generate test cases fulfilling test
covers. There exists a set of desirable properties for the testing
of FSMs. Action Coverage is defined as the desirable property
of executing every possible action at each state at least once.
Action coverage is the easiest test coverage criterion for a
FSM model. Ref. [9] introduces Branch Cover, Switch Cover,
Boundary-Interior Cover and H-Language as test coverage
criteria. Branch Cover traverses an FSM in order to visit each
branch, so that the complexity of all possible paths reaching
to infinity at worst can be reduced. Switch Cover describes a
branch-to-branch tuple, meaning that in and out branches of
a state are covered by test sequences [10]. Boundary-Interior
Cover as described in [9] characterize test sequences causing
loops to be traversed once without additional iterations. HLanguage is a similar approach to for Boundary-Interior
Cover loop testing. 
From Test case generation approach for industrial automation systems 2011

 Furthermore, “the process of deriving tests tends to be unstructured, not reproducible, not documented,
lacking detailed rationales for the test design, and dependent on the ingenuity of single 
engineers” [7].  in Review of Model-Based Testing Approaches
