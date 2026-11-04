#!/bin/bash
# anytime-search time-budget runs, one process (2 worker threads): 3 s, 2 s, 5 s
export WT=/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/super109/wt
cd "$(dirname "$0")"
spec() { echo "M|{\"n\":1000,\"timeMs\":$1,\"timeSlice\":true,\"depth\":14,\"setupDepth\":18}"; }
node --import ./register.mjs tourney.mjs ../runs/T3.jsonl "$(spec 3000)" E 5001 5012 2 > ../runs/T3.log 2>&1
node --import ./register.mjs tourney.mjs ../runs/T2.jsonl "$(spec 2000)" E 5001 5012 2 > ../runs/T2.log 2>&1
node --import ./register.mjs tourney.mjs ../runs/T5.jsonl "$(spec 5000)" E 5001 5008 2 > ../runs/T5.log 2>&1
