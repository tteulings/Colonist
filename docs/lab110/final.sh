cd /tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad
(curl -s -o /dev/null localhost:8110/lab.html) || (cd /tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/lab110/wt && python3 -m http.server 8110 >/dev/null 2>&1 &)
sleep 1
timeout 400 node lab87/scripts/movelog.js /tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/lab110/wt 9843 2>&1 | tail -1
PORT=9679 timeout 900 node rel96/tests/determinism.js /tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/lab110/wt 40 2>&1 | grep -c PASS
PORT=9679 true
cd lab110 && timeout 600 node ui.js 2>&1 | tail -12
