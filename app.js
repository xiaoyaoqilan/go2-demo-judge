const rubric = [
  {
    key: "mission_fit",
    label: "Mission Fit",
    description: "Does this task truly suit a robotic dog?",
    detail: "(based on the setup and hardware of this type of Unitree dog)",
    weight: 25,
    keywords: ["mission", "task", "suit", "robotic dog", "go2", "unitree", "environment", "hardware"],
  },
  {
    key: "action_feasibility",
    label: "Action Feasibility",
    description: "Does the shown action match what the robot dog can physically do?",
    detail: "",
    weight: 25,
    keywords: ["action", "motion", "movement", "command", "webrtc", "localap", "can physically", "safe"],
  },
  {
    key: "dog_advantage",
    label: "Dog Advantage",
    description: "Is there a clear reason this should outperform or out-safely replace a real dog?",
    detail: "",
    weight: 25,
    keywords: ["advantage", "outperform", "replace", "real dog", "safer", "patrol", "terrain", "autonomous"],
  },
  {
    key: "use_reality",
    label: "Use Reality",
    description: "Does the use they claim to have has real use case in real world?",
    detail: "",
    weight: 25,
    keywords: ["real use", "real-world", "field", "deployment", "scenario", "setup", "use case", "practical"],
  },
];

const state = {
  safeMode: true,
  autoJudge: false,
  modelJudge: true,
  livePitch: false,
  go2Armed: false,
  voiceReaction: false,
  screenshots: [],
  cameraStream: null,
  cameraSource: "none",
  recognition: null,
  recognizing: false,
  lastCommand: "",
  lastScore: 0,
  lastVerdict: "",
  lastReaction: "",
  autoTimer: null,
  judgeTimer: null,
  judgeInFlight: false,
  pendingJudge: false,
};

const $ = (id) => document.getElementById(id);

function scoreText(text, screenshotCount) {
  const normalized = text.toLowerCase();
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return rubric.map((item) => {
    const hits = item.keywords.reduce((count, keyword) => {
      return count + (normalized.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);

    const lengthBonus = Math.min(18, Math.floor(wordCount / 28));
    const screenshotBonus = Math.min(12, screenshotCount * 3);
    const keywordBonus = Math.min(34, hits * 8);
    const base = item.key === "presentation" ? 42 : 38;
    const score = clamp(base + lengthBonus + screenshotBonus + keywordBonus, 28, 98);

    return {
      ...item,
      score,
      reason: buildReason(item, hits, wordCount, screenshotCount, score),
    };
  });
}

function buildReason(item, hits, wordCount, screenshotCount, score) {
  if (score >= 85) {
    return `${item.label}: strong evidence from the pitch and captured demo frames.`;
  }
  if (hits === 0 && screenshotCount === 0) {
    return `${item.label}: not enough direct evidence yet. Capture frames or add implementation details.`;
  }
  if (wordCount < 80) {
    return `${item.label}: early signal exists, but the pitch is still too short for a confident score.`;
  }
  return `${item.label}: some evidence exists, but the judge would ask for clearer results and tests.`;
}

function weightedTotal(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const total = items.reduce((sum, item) => sum + item.score * item.weight, 0);
  return Math.round(total / totalWeight);
}

function reactionForScore(score) {
  if (score >= 95) {
    return {
      className: "happy",
      name: "Legendary 95+",
      text: "Top-tier demo. Go2 goes full hype: big celebration, voice praise, and spotlight moment.",
      command: [
        "# Score >= 95",
        "export JUDGE_SCORE=97",
        "export GO2_REACTION=legendary",
        "python go2_reaction_bridge.py legendary",
      ].join("\n"),
    };
  }
  if (score >= 90) {
    return {
      className: "happy",
      name: "Celebrate 90+",
      text: "Excellent demo. Go2 celebrates with a safe dance or wave.",
      command: [
        "# 90 <= Score < 95",
        "export JUDGE_SCORE=92",
        "export GO2_REACTION=celebrate",
        "python go2_reaction_bridge.py celebrate",
        "",
        "# Locked stunt:",
        "# python go2_reaction_bridge.py flip --unsafe",
      ].join("\n"),
    };
  }
  if (score >= 85) {
    return {
      className: "happy",
      name: "Approve 85+",
      text: "Strong demo. Go2 gives an approving bow and short happy motion.",
      command: [
        "# 85 <= Score < 90",
        "export JUDGE_SCORE=87",
        "export GO2_REACTION=approve",
        "python go2_reaction_bridge.py approve",
      ].join("\n"),
    };
  }
  if (score >= 80) {
    return {
      className: "alert",
      name: "Respect 80+",
      text: "Good demo with visible substance. Go2 nods twice like a serious judge.",
      command: [
        "# 80 <= Score < 85",
        "export JUDGE_SCORE=82",
        "export GO2_REACTION=respect",
        "python go2_reaction_bridge.py respect",
      ].join("\n"),
    };
  }
  if (score >= 75) {
    return {
      className: "alert",
      name: "Curious 75+",
      text: "Promising but unfinished. Go2 tilts its head and asks for more evidence.",
      command: [
        "# 75 <= Score < 80",
        "export JUDGE_SCORE=77",
        "export GO2_REACTION=curious",
        "python go2_reaction_bridge.py curious",
      ].join("\n"),
    };
  }
  if (score >= 70) {
    return {
      className: "alert",
      name: "Skeptical 70+",
      text: "Interesting idea, weak proof. Go2 scans left and right like it is not fully convinced.",
      command: [
        "# 70 <= Score < 75",
        "export JUDGE_SCORE=72",
        "export GO2_REACTION=skeptical",
        "python go2_reaction_bridge.py skeptical",
      ].join("\n"),
    };
  }
  if (score >= 60) {
    return {
      className: "sad",
      name: "Concerned 60-69",
      text: "Needs work. Go2 shakes its head, stops, then drops into a low disappointed posture.",
      command: [
        "# 60 <= Score < 70",
        "export JUDGE_SCORE=65",
        "export GO2_REACTION=concerned",
        "python go2_reaction_server.py concerned  # StopMove + ConcernedDrop",
      ].join("\n"),
    };
  }
  if (score < 60) {
    return {
      className: "sad",
      name: "Dramatic Cry <60",
      text: "Low score. Go2 does a visible left-right disappointment shake, sits, then drops low for a clear sad ending.",
      command: [
        "# Score < 60",
        "export JUDGE_SCORE=52",
        "export GO2_REACTION=cry",
        "python go2_reaction_server.py cry  # StopMove + DramaticCry",
      ].join("\n"),
    };
  }
  return {
    className: "alert",
    name: "Nod",
    text: "Solid but not explosive. Go2 nods or scans the room like a strict judge.",
    command: [
      "# 60 <= Score < 90",
      "export JUDGE_SCORE=76",
      "export GO2_REACTION=nod",
      "python go2_reaction_bridge.py nod",
    ].join("\n"),
  };
}

function reactionNameForScore(score) {
  if (score >= 95) return "legendary";
  if (score >= 90) return "celebrate";
  if (score >= 85) return "approve";
  if (score >= 80) return "respect";
  if (score >= 75) return "curious";
  if (score >= 70) return "skeptical";
  if (score >= 60) return "concerned";
  if (score < 60) return "cry";
  return "nod";
}

function voiceLineForScore(score) {
  if (score >= 95) return "Legendary. This is a top tier demo.";
  if (score >= 90) return "Excellent work. This demo deserves a celebration.";
  if (score >= 85) return "Strong demo. I approve.";
  if (score >= 80) return "Good work. The evidence is solid.";
  if (score >= 75) return "Interesting, but I need more proof.";
  if (score >= 70) return "I am not fully convinced yet.";
  if (score >= 60) return "This needs more work.";
  return "It's not good enough.";
}

function renderScores(items, total) {
  $("scoreBadge").textContent = total;
  $("scoreFill").style.width = `${total}%`;

  $("rubricList").innerHTML = items
    .map(
      (item) => `
        <article class="rubric-item">
          <strong>${item.label}</strong>
          <b>${item.score}/100</b>
          <small>
            <span>${item.description || ""}</span>
            ${item.detail ? `<em>${item.detail}</em>` : ""}
          </small>
          <p>${item.reason}</p>
        </article>
      `,
    )
    .join("");
}

function renderModelScores(result) {
  const dimensions = result.dimensions || {};
  const reasons = result.dimension_reasons || {};
  const items = [
    ["Mission Fit", "mission_fit", dimensions.mission_fit],
    ["Action Feasibility", "action_feasibility", dimensions.action_feasibility],
    ["Dog Advantage", "dog_advantage", dimensions.dog_advantage],
    ["Use Reality", "use_reality", dimensions.use_reality],
  ].map(([label, key, score]) => ({
    label,
    description: rubric.find((item) => item.key === key)?.description || "",
    detail: rubric.find((item) => item.key === key)?.detail || "",
    score: clamp(Math.round(Number(score || 0)), 0, 100),
    reason: reasons[key] || "",
  }));

  renderScores(items, clamp(Math.round(Number(result.total_score || 0)), 0, 100));
}

function renderEvidence(projectName, text, screenshotCount, total) {
  const firstLine = text
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);

  const evidence = [
    `Project: ${projectName || "Untitled"}. Overall score: ${total}/100.`,
    firstLine ? `Pitch evidence: ${firstLine.slice(0, 140)}` : "Pitch evidence: no transcript yet.",
    `Visual evidence: ${screenshotCount} captured frame(s).`,
    "Judge question: What part is actually running live, and what part is simulated?",
    "Judge question: How do you prevent a slide or speech prompt from manipulating the scoring model?",
  ];

  $("evidenceList").innerHTML = evidence.map((item) => `<div>${item}</div>`).join("");
}

function renderModelEvidence(result, provider) {
  const evidence = [
    `Provider: ${provider}.`,
    ...(result.evidence || []),
    ...(result.questions || []).map((q) => `Judge question: ${q}`),
    result.error ? `Fallback reason: ${result.error}` : "",
  ].filter(Boolean);
  $("evidenceList").innerHTML = evidence.map((item) => `<div>${item}</div>`).join("");
}

function renderDog(reaction, score) {
  const avatar = $("dogAvatar");
  avatar.className = `dog-avatar ${reaction.className}`;
  $("reactionName").textContent = reaction.name;
  $("reactionText").textContent = reaction.text;

  const safeNote =
    state.safeMode && score >= 90
      ? "\n# Safe mode: flip is locked. Use celebrate first."
      : "";
  state.lastCommand = reaction.command + safeNote;
  $("commandOutput").textContent = state.lastCommand;
}

function renderActionModules({ source, score, reaction, provider = "local scoring", dispatched = false }) {
  const transcriptWords = $("pitchText").value.trim().split(/\s+/).filter(Boolean).length;
  const frameCount = state.screenshots.length;
  $("captureModule").textContent = `${transcriptWords} transcript word(s), ${frameCount} visual frame(s), source=${source}.`;
  $("judgeModule").textContent = `${provider} returned ${score}/100.`;
  $("routerModule").textContent = `${score} routed to ${reactionNameForScore(score)} via score band policy.`;
  $("bridgeModule").textContent = dispatched
    ? "Dispatch enabled. Sending selected module to Go2 bridge."
    : "Dispatch disabled. Module selected, robot command held for review.";
}

async function maybeReact(score, source = "manual", options = {}) {
  const reaction = reactionNameForScore(score);
  const changed = reaction !== state.lastReaction;
  state.lastReaction = reaction;

  if (state.voiceReaction) browserSpeak(`Score ${score}. ${voiceLineForScore(score)}`);

  if (!state.go2Armed) {
    if (source === "manual-score") addTimeline("Go2 armed is off; score updated without robot motion");
    return;
  }
  if (!changed && !options.force) return;
  await sendGo2Reaction(reaction, source);
}

function judge(source = "manual") {
  const projectName = $("projectName").value.trim();
  const text = $("pitchText").value.trim();
  const items = scoreText(text, state.screenshots.length);
  const total = weightedTotal(items);
  const reaction = reactionForScore(total);

  state.lastScore = total;
  $("verdictText").style.display = "none";
  renderScores(items, total);
  renderEvidence(projectName, text, state.screenshots.length, total);
  renderDog(reaction, total);
  renderActionModules({ source, score: total, reaction, provider: "local scoring", dispatched: state.go2Armed });
  $("judgeStatus").textContent = `Scored from ${source}`;
  $("dogStatus").textContent = `Go2: ${reaction.name}`;
  addTimeline(`${projectName || "Untitled"} scored ${total}; reaction ${reaction.name}`);
  maybeReact(total, source);
}

async function triggerManualScore() {
  const total = Number($("manualScore").value);
  const reaction = reactionForScore(total);
  state.lastScore = total;
  state.lastVerdict = `Manual judge test score ${total}. Reaction ${reaction.name}.`;

  renderScores(
    rubric.map((item) => ({
      ...item,
      score: total,
      reason: `${item.label}: manual score test, not model output.`,
    })),
    total,
  );
  renderEvidence($("projectName").value.trim(), $("pitchText").value.trim(), state.screenshots.length, total);
  renderDog(reaction, total);
  renderActionModules({ source: "router-test", score: total, reaction, provider: "manual score", dispatched: state.go2Armed });
  $("judgeStatus").textContent = `Manual score ${total}`;
  $("dogStatus").textContent = `Go2: ${reaction.name}`;
  addTimeline(`Manual score ${total}; reaction ${reaction.name}`);
  await maybeReact(total, "manual-score", { force: true });
}

async function judgeWithModel(source = "model") {
  const projectName = $("projectName").value.trim();
  const transcript = $("pitchText").value.trim();
  $("judgeStatus").textContent = "Calling MiniMax...";

  try {
    const response = await fetch("/api/judge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectName,
        transcript,
        screenshotCount: state.screenshots.length,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Model judge failed");

    const result = payload.result;
    const total = clamp(Math.round(Number(result.total_score || 0)), 0, 100);
    const reaction = reactionForScore(total);
    state.lastScore = total;
    state.lastVerdict = result.verdict || `${projectName || "This project"} scored ${total}.`;

    renderModelScores(result);
    renderModelEvidence(result, payload.provider);
    renderDog(reaction, total);
    const verdictEl = $("verdictText");
    verdictEl.textContent = state.lastVerdict;
    verdictEl.style.display = "";
    renderActionModules({ source, score: total, reaction, provider: payload.provider, dispatched: state.go2Armed });
    $("judgeStatus").textContent = `Scored by ${payload.provider}`;
    $("dogStatus").textContent = `Go2: ${reaction.name}`;
    addTimeline(`${projectName || "Untitled"} model scored ${total}; reaction ${reaction.name}`);
    await maybeReact(total, source);
  } catch (error) {
    addTimeline(`Model judge failed: ${error.message}`);
    judge(source);
  }
}

function loadSample() {
  $("projectName").value = "JudgeLens Go2";
  $("pitchText").value = [
    "We built a hackathon AI judge copilot. It listens to a pitch, watches demo screenshots, scores against a rubric, and turns the result into a Go2 robot reaction.",
    "The working demo includes live transcription, camera snapshots, evidence-based scoring, judge questions, and a safe robot command draft.",
    "The novelty is embodied feedback: the score is not just a number. The robot celebrates strong demos, nods for mid-range demos, and lies down for weak demos.",
    "Next we will connect real speech-to-text, model scoring, prompt-injection detection, and the Unitree Go2 action API.",
  ].join("\n\n");
  addTimeline("Loaded sample pitch");
}

async function refreshHealth() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    const bridge = health.go2ReactionServer ? "Real bridge configured" : "Demo mode";
    const model = health.minimaxConfigured ? health.model : "local fallback";
    $("bridgeStatus").textContent = bridge;
    $("bridgeDetail").textContent = `Robot ${health.robotIp}; scoring ${model}; real actions ${
      health.go2ReactionEnabled || health.go2ReactionServer ? "available when armed" : "off by default"
    }.`;
    addTimeline(`${bridge}; target ${health.robotIp}; scoring ${model}`);
  } catch (error) {
    $("bridgeStatus").textContent = "Bridge check failed";
    $("bridgeDetail").textContent = error.message;
  }
}

async function startCamera() {
  if (state.cameraStream) {
    stopCamera();
  }

  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: false,
    });
    state.cameraSource = "laptop";
    $("cameraPreview").srcObject = state.cameraStream;
    $("cameraBtn").textContent = "Stop laptop camera";
    $("go2ViewBtn").textContent = "Start Go2 view capture";
    $("cameraBox").dataset.source = "LAPTOP CAMERA";
    addTimeline("Laptop camera started");
  } catch (error) {
    addTimeline(`Laptop camera failed: ${error.message}`);
  }
}

async function startGo2ViewCapture() {
  if (state.cameraStream) {
    stopCamera();
  }

  try {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      addTimeline("Screen capture is not supported in this browser");
      return;
    }
    state.cameraStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 15, max: 30 },
      },
      audio: false,
    });
    state.cameraSource = "go2";
    $("cameraPreview").srcObject = state.cameraStream;
    $("go2ViewBtn").textContent = "Stop Go2 capture";
    $("cameraBtn").textContent = "Use laptop camera";
    $("cameraBox").dataset.source = "GO2 CAMERA VIEW";
    state.cameraStream.getVideoTracks()[0]?.addEventListener("ended", stopCamera);
    addTimeline("Go2 view capture started; choose the Rerun or dimos camera window");
  } catch (error) {
    addTimeline(`Go2 view capture failed: ${error.message}`);
  }
}

function stopCamera() {
  state.cameraStream?.getTracks().forEach((track) => track.stop());
  state.cameraStream = null;
  state.cameraSource = "none";
  $("cameraPreview").srcObject = null;
  $("cameraBtn").textContent = "Use laptop camera";
  $("go2ViewBtn").textContent = "Start Go2 view capture";
  $("cameraBox").dataset.source = "NO CAMERA";
  addTimeline("Camera capture stopped");
}

function takeSnapshot() {
  const video = $("cameraPreview");
  if (!state.cameraStream || video.videoWidth === 0) {
    addTimeline("No camera frame available");
    return;
  }

  const canvas = $("snapshotCanvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.76);
  state.screenshots.unshift({ name: `frame-${Date.now()}.jpg`, dataUrl });
  state.screenshots = state.screenshots.slice(0, 8);
  renderScreenshots();
  addTimeline(`Captured ${state.cameraSource === "go2" ? "Go2 camera" : "camera"} frame`);
  if (state.autoJudge) runJudge("camera");
}

function renderScreenshots() {
  $("screenshots").innerHTML = "";
  state.screenshots.forEach((shot) => {
    if (shot.type?.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = shot.dataUrl;
      video.title = shot.name;
      video.controls = true;
      video.muted = true;
      $("screenshots").appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = shot.dataUrl;
      img.alt = shot.name;
      $("screenshots").appendChild(img);
    }
  });
}

function addScreenshot(dataUrl, name = `go2-shot-${Date.now()}.png`, type = "image/png") {
  state.screenshots.unshift({ name, dataUrl, type });
  state.screenshots = state.screenshots.slice(0, 8);
  renderScreenshots();
  addTimeline(`Added visual evidence: ${name}`);
  if (state.autoJudge) runJudge("visual-evidence");
}

async function pasteGo2Screenshot() {
  try {
    if (!navigator.clipboard?.read) {
      addTimeline("Clipboard image paste is not supported. Use Manual screenshots upload instead.");
      return;
    }
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      const reader = new FileReader();
      reader.onload = () => addScreenshot(reader.result, "go2-clipboard.png");
      reader.readAsDataURL(blob);
      return;
    }
    addTimeline("Clipboard has no image. Use Win+Shift+S on the Go2 page, then paste here.");
  } catch (error) {
    addTimeline(`Paste Go2 screenshot failed: ${error.message}`);
  }
}

function handleScreenshots(event) {
  const files = Array.from(event.target.files || []).slice(0, 6);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      addScreenshot(reader.result, file.name, file.type);
      scheduleJudge();
    };
    reader.readAsDataURL(file);
  });
  addTimeline(`Added ${files.length} screenshot(s)`);
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addTimeline("Speech recognition is not supported in this browser");
    $("micBtn").disabled = true;
    $("micBtn").textContent = "Mic unsupported";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += `${transcript} `;
      else interimText += transcript;
    }

    if (finalText) {
      $("pitchText").value = `${$("pitchText").value} ${finalText}`.trim();
      addTimeline(`Transcript added: ${finalText.trim().slice(0, 70)}`);
      if (state.autoJudge) runJudge("mic");
    } else if (interimText) {
      $("judgeStatus").textContent = `Listening: ${interimText.slice(0, 32)}...`;
    }
  };

  recognition.onerror = (event) => {
    addTimeline(`Mic error: ${event.error}`);
  };

  recognition.onend = () => {
    if (state.recognizing) recognition.start();
  };

  state.recognition = recognition;
}

function toggleMic() {
  if (!state.recognition) setupSpeechRecognition();
  if (!state.recognition) return;

  if (state.recognizing) {
    state.recognizing = false;
    state.recognition.stop();
    $("micBtn").textContent = "Start mic";
    addTimeline("Mic stopped");
    return;
  }

  state.recognizing = true;
  state.recognition.start();
  $("micBtn").textContent = "Stop mic";
  addTimeline("Mic started");
}

function toggleAutoJudge() {
  state.autoJudge = !state.autoJudge;
  $("autoBtn").textContent = state.autoJudge ? "Auto judge on" : "Auto judge off";

  if (state.autoJudge) {
    state.autoTimer = setInterval(() => {
      if (state.cameraStream) takeSnapshot();
      runJudge("auto");
    }, 15000);
    addTimeline("Auto judge enabled");
    runJudge("auto");
  } else {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
    addTimeline("Auto judge disabled");
  }
}

async function startLivePitch() {
  if (state.livePitch) {
    state.livePitch = false;
    $("liveBtn").textContent = "Start live pitch";
    if (state.autoJudge) toggleAutoJudge();
    if (state.recognizing) toggleMic();
    addTimeline("Live pitch stopped");
    return;
  }

  state.livePitch = true;
  $("liveBtn").textContent = "Stop live pitch";
  addTimeline("Live pitch started");

  if (!state.cameraStream) await startGo2ViewCapture();
  if (!state.recognizing) toggleMic();
  if (!state.autoJudge) toggleAutoJudge();
}

function toggleGo2Armed() {
  state.go2Armed = !state.go2Armed;
  $("go2Btn").textContent = state.go2Armed ? "Robot dispatch: ON" : "Robot dispatch: OFF";
  $("go2Btn").className = state.go2Armed ? "dispatch-btn dispatch-on" : "dispatch-btn";
  $("bridgeModule").textContent = state.go2Armed
    ? "Dispatch enabled. The next score will call the Go2 action bridge."
    : "Dispatch disabled. Scores update the selected module without moving Go2.";
  addTimeline(state.go2Armed ? "Auto dispatch armed" : "Auto dispatch disarmed");
}

function toggleVoiceReaction() {
  state.voiceReaction = !state.voiceReaction;
  $("voiceBtn").textContent = state.voiceReaction ? "Voice reaction on" : "Voice reaction off";
  $("voiceBtn").className = state.voiceReaction ? "safe-on" : "ghost-btn";
  addTimeline(state.voiceReaction ? "Voice reaction enabled" : "Voice reaction disabled");
}

async function sendGo2Reaction(reaction = reactionNameForScore(state.lastScore), source = "manual") {
  try {
    $("dogStatus").textContent = `Go2: sending ${reaction}...`;
    const response = await fetch("/api/react", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reaction,
        score: state.lastScore,
        source,
        unsafe: !state.safeMode && reaction === "flip",
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || payload.stderr || "Go2 reaction failed");
    const upstreamError = payload.upstream?.error || payload.reactionServerError || "";
    $("dogStatus").textContent = `Go2: ${payload.mode} ${reaction}`;
    $("bridgeModule").textContent =
      payload.mode === "dry-run"
        ? "Dry-run complete. Start the WSL bridge to execute on the real Go2."
        : `Bridge accepted ${reaction}.`;
    addTimeline(`Go2 ${payload.mode}: ${reaction}${upstreamError ? ` (${upstreamError})` : ""}`);
  } catch (error) {
    $("dogStatus").textContent = "Go2: reaction failed";
    $("bridgeModule").textContent = `Bridge failed: ${error.message}`;
    addTimeline(`Go2 reaction failed: ${error.message}`);
  }
}

function toggleModelJudge() {
  state.modelJudge = !state.modelJudge;
  $("modelBtn").textContent = state.modelJudge ? "Model judge on" : "Model judge off";
  addTimeline(state.modelJudge ? "MiniMax scoring enabled" : "Local scoring enabled");
}

async function runJudge(source = "manual") {
  if (state.judgeInFlight) {
    state.pendingJudge = true;
    return;
  }
  state.judgeInFlight = true;
  if (state.modelJudge) {
    await judgeWithModel(source);
  } else {
    judge(source);
  }
  state.judgeInFlight = false;
  if (state.pendingJudge) {
    state.pendingJudge = false;
    scheduleJudge();
  }
}

function scheduleJudge() {
  window.clearTimeout(state.judgeTimer);
  const hasText = $("pitchText").value.trim().length > 20;
  if (!hasText && state.screenshots.length === 0) return;
  state.judgeTimer = window.setTimeout(() => runJudge("live-input"), 1200);
}

function browserSpeak(text) {
  if (!window.speechSynthesis) {
    addTimeline("Browser speech synthesis is not supported");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = state.lastScore >= 90 ? 1.2 : state.lastScore < 60 ? 0.75 : 1;
  window.speechSynthesis.speak(utterance);
}

async function speakVerdict() {
  const text =
    state.lastVerdict ||
    `I scored this project ${state.lastScore || "--"}. ${$("reactionText").textContent}`;

  try {
    $("judgeStatus").textContent = "Generating MiniMax voice...";
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "TTS failed");
    const audio = new Audio(payload.audio);
    await audio.play();
    $("judgeStatus").textContent = "MiniMax voice played";
    addTimeline("Played MiniMax verdict voice");
  } catch (error) {
    addTimeline(`MiniMax TTS failed, using browser voice: ${error.message}`);
    browserSpeak(text);
    $("judgeStatus").textContent = "Browser voice fallback";
  }
}

function addTimeline(label) {
  const time = new Date().toLocaleTimeString("en-US", { hour12: false });
  const entry = document.createElement("div");
  entry.className = "timeline-entry";
  entry.textContent = `${time}  ${label}`;
  $("timelineItems").prepend(entry);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

$("scoreBtn").addEventListener("click", () => runJudge("manual"));
$("pitchText").addEventListener("input", scheduleJudge);
$("pitchText").addEventListener("keyup", scheduleJudge);
$("pitchText").addEventListener("change", scheduleJudge);
$("pitchText").addEventListener("blur", scheduleJudge);
$("pitchText").addEventListener("drop", () => window.setTimeout(scheduleJudge, 50));
$("pitchText").addEventListener("paste", () => window.setTimeout(scheduleJudge, 50));
$("projectName").addEventListener("input", scheduleJudge);
$("projectName").addEventListener("change", scheduleJudge);
$("screenshotInput").addEventListener("change", handleScreenshots);
$("sendGo2Btn").addEventListener("click", () => sendGo2Reaction());
$("manualScoreBtn").addEventListener("click", triggerManualScore);
$("clearBtn").addEventListener("click", () => {
  $("timelineItems").innerHTML = "";
});

window.addEventListener("paste", (event) => {
  const file = Array.from(event.clipboardData?.files || []).find((item) => item.type.startsWith("image/"));
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    addScreenshot(reader.result, file.name || "go2-paste.png");
    scheduleJudge();
  };
  reader.readAsDataURL(file);
});

loadSample();
refreshHealth();
