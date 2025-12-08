const LOCAL_IP_ADDRESS = window.location.hostname;
let socket = io.connect(`http://${LOCAL_IP_ADDRESS}:8000`);

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const constraints = {
  video: {
    width: { ideal: 320, max: 480 },
    height: { ideal: 240, max: 360 },
    frameRate: { ideal: 15, max: 15 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

// ========== NSFW.js Setup ==========
let nsfwModel = null;
let isMonitoring = false;
let monitoringInterval = null;

// Load NSFW.js model
async function loadNSFWModel() {
  try {
    console.log("Loading NSFW.js model...");
    nsfwModel = await nsfwjs.load();
    console.log("✓ NSFW.js model loaded successfully");
    return true;
  } catch (error) {
    console.error("Failed to load NSFW.js model:", error);
    return false;
  }
}

// Analyze video frame for NSFW content
async function analyzeFrame(videoElement) {
  if (!nsfwModel || !videoElement.srcObject) return null;

  try {
    const predictions = await nsfwModel.classify(videoElement);
    return predictions;
  } catch (error) {
    console.error("Error analyzing frame:", error);
    return null;
  }
}

// Monitor video stream continuously
function startNSFWMonitoring(videoElement, onDetection) {
  if (isMonitoring) return;

  isMonitoring = true;
  console.log("🔍 Starting NSFW monitoring...");

  // Check every 3 seconds (balance between performance and detection)
  monitoringInterval = setInterval(async () => {
    const predictions = await analyzeFrame(videoElement);

    if (predictions) {
      console.log("NSFW Predictions:", predictions);

      // Find the highest probability category
      const sorted = predictions.sort((a, b) => b.probability - a.probability);
      const topPrediction = sorted[0];

      // Define thresholds (adjust as needed)
      const nsfwCategories = ['Porn', 'Sexy', 'Hentai'];
      const threshold = 0.6; // 60% confidence

      if (nsfwCategories.includes(topPrediction.className) &&
          topPrediction.probability > threshold) {
        console.warn("⚠️ NSFW content detected:", topPrediction);
        if (onDetection) {
          onDetection(topPrediction, predictions);
        }
      }
    }
  }, 3000);
}

function stopNSFWMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    isMonitoring = false;
    console.log("🛑 NSFW monitoring stopped");
  }
}

// Handle NSFW detection - you can customize this
function handleNSFWDetection(prediction, allPredictions) {
  // Option 1: Blur the video
  blurVideo(remoteVideo);

  // Option 2: Show warning overlay
  showWarningOverlay(`Inappropriate content detected (${prediction.className}: ${(prediction.probability * 100).toFixed(1)}%)`);

  // Option 3: Auto-skip to next user
  // disconnectAndNext();

  // Option 4: Report to server
  socket.emit("reportNSFW", {
    room: roomName,
    prediction: prediction,
    timestamp: Date.now()
  });
}

function blurVideo(videoElement) {
  videoElement.style.filter = "blur(20px)";
  setTimeout(() => {
    videoElement.style.filter = "none";
  }, 5000); // Remove blur after 5 seconds
}

function showWarningOverlay(message) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 0, 0, 0.9);
    color: white;
    padding: 20px;
    border-radius: 10px;
    z-index: 1000;
    font-weight: bold;
  `;
  overlay.textContent = message;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.remove();
  }, 5000);
}

// ========== Original WebRTC Code with NSFW Integration ==========

console.log(isMobile ? "📱 Mobile mode - optimized for smoothness" : "💻 Desktop mode - optimized for smoothness");

const getElement = id => document.getElementById(id);
const [btnConnect, btnToggleVideo, btnToggleAudio, divRoomConfig, roomDiv, roomNameInput, localVideo, remoteVideo] = ["btnConnect",
  "toggleVideo", "toggleAudio", "roomConfig", "roomDiv", "roomName",
  "localVideo", "remoteVideo"].map(getElement);
let remoteDescriptionPromise, roomName, localStream, remoteStream,
    rtcPeerConnection, isCaller;

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

const streamConstraints = constraints;

btnToggleVideo.addEventListener("click", () => toggleTrack("video"));
btnToggleAudio.addEventListener("click", () => toggleTrack("audio"));

function toggleTrack(trackType) {
  if (!localStream) {
    return;
  }

  const track = trackType === "video" ? localStream.getVideoTracks()[0]
      : localStream.getAudioTracks()[0];
  const enabled = !track.enabled;
  track.enabled = enabled;

  const toggleButton = getElement(
      `toggle${trackType.charAt(0).toUpperCase() + trackType.slice(1)}`);
  const icon = getElement(`${trackType}Icon`);
  toggleButton.classList.toggle("disabled-style", !enabled);
  toggleButton.classList.toggle("enabled-style", enabled);
  icon.classList.toggle("bi-camera-video-fill",
      trackType === "video" && enabled);
  icon.classList.toggle("bi-camera-video-off-fill",
      trackType === "video" && !enabled);
  icon.classList.toggle("bi-mic-fill", trackType === "audio" && enabled);
  icon.classList.toggle("bi-mic-mute-fill", trackType === "audio" && !enabled);
}

function applyBitrateLimit(peerConnection) {
  peerConnection.getSenders().forEach(sender => {
    if (sender.track && sender.track.kind === 'video') {
      const parameters = sender.getParameters();
      if (!parameters.encodings) {
        parameters.encodings = [{}];
      }
      parameters.encodings[0].maxBitrate = 200000;
      parameters.encodings[0].maxFramerate = 15;
      sender.setParameters(parameters).then(() => {
        console.log("✓ Video optimized for smooth random chat");
      }).catch(err =>
        console.log("Error setting bitrate:", err)
      );
    }
  });

  setTimeout(() => {
    peerConnection.getSenders().forEach(sender => {
      if (sender.track && sender.track.kind === 'video') {
        const settings = sender.track.getSettings();
        console.log("📹 Sending:", settings.width + "x" + settings.height + " @ " + settings.frameRate + "fps");
      }
    });
  }, 2000);
}

// Load NSFW model on page load
loadNSFWModel();

btnConnect.onclick = () => {
  if (roomNameInput.value === "") {
    alert("Room can not be null!");
  } else {
    roomName = roomNameInput.value;
    socket.emit("joinRoom", roomName);
    divRoomConfig.classList.add("d-none");
    roomDiv.classList.remove("d-none");
  }
};

const handleSocketEvent = (eventName, callback) => socket.on(eventName,
    callback);

handleSocketEvent("created", e => {
  console.log("Room created, requesting camera access...");
  navigator.mediaDevices.getUserMedia(streamConstraints).then(stream => {
    console.log("Camera access granted!");

    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    console.log("Camera settings:", settings);
    console.log(`Resolution: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);

    localStream = stream;
    localVideo.srcObject = stream;
    localVideo.muted = true;
    isCaller = true;

    // Start monitoring local video (optional - to check your own stream)
    // startNSFWMonitoring(localVideo, handleNSFWDetection);
  }).catch(error => {
    console.error("Camera error:", error);
    alert(`Camera access failed: ${error.name} - ${error.message}`);
  });
});

handleSocketEvent("joined", e => {
  console.log("Joined room, requesting camera access...");
  navigator.mediaDevices.getUserMedia(streamConstraints).then(stream => {
    console.log("Camera access granted!");

    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    console.log("Camera settings:", settings);
    console.log(`Resolution: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);

    localStream = stream;
    localVideo.srcObject = stream;
    localVideo.muted = true;
    socket.emit("ready", roomName);

    // Start monitoring local video (optional)
    // startNSFWMonitoring(localVideo, handleNSFWDetection);
  }).catch(error => {
    console.error("Camera error:", error);
    alert(`Camera access failed: ${error.name} - ${error.message}`);
  });
});

handleSocketEvent("candidate", e => {
  if (rtcPeerConnection) {
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: e.label, candidate: e.candidate,
    });

    rtcPeerConnection.onicecandidateerror = (error) => {
      console.error("Error adding ICE candidate: ", error);
    };

    if (remoteDescriptionPromise) {
      remoteDescriptionPromise
      .then(() => {
        if (candidate != null) {
          return rtcPeerConnection.addIceCandidate(candidate);
        }
      })
      .catch(error => console.log(
          "Error adding ICE candidate after remote description: ", error));
    }
  }
});

handleSocketEvent("ready", e => {
  if (isCaller) {
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = onIceCandidate;
    rtcPeerConnection.ontrack = onAddStream;

    localStream.getTracks().forEach(track => {
      console.log("Adding track:", track.kind);
      rtcPeerConnection.addTrack(track, localStream);
    });

    rtcPeerConnection
    .createOffer()
    .then(sessionDescription => {
      rtcPeerConnection.setLocalDescription(sessionDescription);
      socket.emit("offer", {
        type: "offer", sdp: sessionDescription, room: roomName,
      });
      applyBitrateLimit(rtcPeerConnection);
    })
    .catch(error => console.log(error));
  }
});

handleSocketEvent("offer", e => {
  if (!isCaller) {
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = onIceCandidate;
    rtcPeerConnection.ontrack = onAddStream;

    localStream.getTracks().forEach(track => {
      console.log("Adding track:", track.kind);
      rtcPeerConnection.addTrack(track, localStream);
    });

    if (rtcPeerConnection.signalingState === "stable") {
      remoteDescriptionPromise = rtcPeerConnection.setRemoteDescription(
          new RTCSessionDescription(e));
      remoteDescriptionPromise
      .then(() => {
        return rtcPeerConnection.createAnswer();
      })
      .then(sessionDescription => {
        rtcPeerConnection.setLocalDescription(sessionDescription);
        socket.emit("answer", {
          type: "answer", sdp: sessionDescription, room: roomName,
        });
        applyBitrateLimit(rtcPeerConnection);
      })
      .catch(error => console.log(error));
    }
  }
});

handleSocketEvent("answer", e => {
  if (isCaller && rtcPeerConnection.signalingState === "have-local-offer") {
    remoteDescriptionPromise = rtcPeerConnection.setRemoteDescription(
        new RTCSessionDescription(e));
    remoteDescriptionPromise.catch(error => console.log(error));
  }
});

handleSocketEvent("userDisconnected", (e) => {
  remoteVideo.srcObject = null;
  isCaller = true;
  // Stop monitoring when user disconnects
  stopNSFWMonitoring();
});

handleSocketEvent("setCaller", callerId => {
  isCaller = socket.id === callerId;
});

handleSocketEvent("full", e => {
  alert("room is full!");
  window.location.reload();
});

const onIceCandidate = e => {
  if (e.candidate) {
    console.log("sending ice candidate");
    socket.emit("candidate", {
      type: "candidate",
      label: e.candidate.sdpMLineIndex,
      id: e.candidate.sdpMid,
      candidate: e.candidate.candidate,
      room: roomName,
    });
  }
}

const onAddStream = e => {
  remoteVideo.srcObject = e.streams[0];
  remoteStream = e.stream;

  // START MONITORING REMOTE VIDEO FOR NSFW CONTENT
  console.log("Remote stream received, starting NSFW monitoring...");

  // Wait a bit for video to start playing
  remoteVideo.onloadeddata = () => {
    startNSFWMonitoring(remoteVideo, handleNSFWDetection);
  };
}
//const LOCAL_IP_ADDRESS = window.location.hostname;
//let socket = io.connect(`http://${LOCAL_IP_ADDRESS}:8000`);
//
//// Omegle-style random chat - optimized for SPEED and SMOOTHNESS over quality
//// Mobile-first approach since most users will be on phones
//const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
//
//const constraints = {
//  video: {
//    width: { ideal: 320, max: 480 },
//    height: { ideal: 240, max: 360 },
//    frameRate: { ideal: 15, max: 15 } // Force 15fps, no higher
//  },
//  audio: {
//    echoCancellation: true,
//    noiseSuppression: true,
//    autoGainControl: true
//  }
//};
//
//console.log(isMobile ? "📱 Mobile mode - optimized for smoothness" : "💻 Desktop mode - optimized for smoothness");
//
//const getElement = id => document.getElementById(id);
//const [btnConnect, btnToggleVideo, btnToggleAudio, divRoomConfig, roomDiv, roomNameInput, localVideo, remoteVideo] = ["btnConnect",
//  "toggleVideo", "toggleAudio", "roomConfig", "roomDiv", "roomName",
//  "localVideo", "remoteVideo"].map(getElement);
//let remoteDescriptionPromise, roomName, localStream, remoteStream,
//    rtcPeerConnection, isCaller;
//
//const iceServers = {
//  iceServers: [
//    {urls: `stun:${LOCAL_IP_ADDRESS}:3478`},
//    {
//      urls: `turn:${LOCAL_IP_ADDRESS}:3478`,
//      username: "username",
//      credential: "password"
//    }
//  ]
//};
//
//const streamConstraints = constraints; // Use optimized constraints
//
//btnToggleVideo.addEventListener("click", () => toggleTrack("video"));
//btnToggleAudio.addEventListener("click", () => toggleTrack("audio"));
//
//function toggleTrack(trackType) {
//  if (!localStream) {
//    return;
//  }
//
//  const track = trackType === "video" ? localStream.getVideoTracks()[0]
//      : localStream.getAudioTracks()[0];
//  const enabled = !track.enabled;
//  track.enabled = enabled;
//
//  const toggleButton = getElement(
//      `toggle${trackType.charAt(0).toUpperCase() + trackType.slice(1)}`);
//  const icon = getElement(`${trackType}Icon`);
//  toggleButton.classList.toggle("disabled-style", !enabled);
//  toggleButton.classList.toggle("enabled-style", enabled);
//  icon.classList.toggle("bi-camera-video-fill",
//      trackType === "video" && enabled);
//  icon.classList.toggle("bi-camera-video-off-fill",
//      trackType === "video" && !enabled);
//  icon.classList.toggle("bi-mic-fill", trackType === "audio" && enabled);
//  icon.classList.toggle("bi-mic-mute-fill", trackType === "audio" && !enabled);
//}
//
//// Helper function to apply bitrate limits
//function applyBitrateLimit(peerConnection) {
//  peerConnection.getSenders().forEach(sender => {
//    if (sender.track && sender.track.kind === 'video') {
//      const parameters = sender.getParameters();
//      if (!parameters.encodings) {
//        parameters.encodings = [{}];
//      }
//      // Low bitrate for instant connection - quality doesn't matter much for random chat
//      parameters.encodings[0].maxBitrate = 200000; // 200kbps - works on 3G/4G
//      parameters.encodings[0].maxFramerate = 15;
//      sender.setParameters(parameters).then(() => {
//        console.log("✓ Video optimized for smooth random chat");
//      }).catch(err =>
//        console.log("Error setting bitrate:", err)
//      );
//    }
//  });
//
//  // Check actual sending quality
//  setTimeout(() => {
//    peerConnection.getSenders().forEach(sender => {
//      if (sender.track && sender.track.kind === 'video') {
//        const settings = sender.track.getSettings();
//        console.log("📹 Sending:", settings.width + "x" + settings.height + " @ " + settings.frameRate + "fps");
//      }
//    });
//  }, 2000);
//}
//
//// Add connection quality monitoring
//function monitorConnectionQuality(peerConnection) {
//  setInterval(() => {
//    peerConnection.getStats().then(stats => {
//      stats.forEach(report => {
//        if (report.type === 'inbound-rtp' && report.kind === 'video') {
//          console.log('FPS:', report.framesPerSecond, 'Packets Lost:', report.packetsLost);
//        }
//      });
//    });
//  }, 5000);
//}
//
//btnConnect.onclick = () => {
//  if (roomNameInput.value === "") {
//    alert("Room can not be null!");
//  } else {
//    roomName = roomNameInput.value;
//    socket.emit("joinRoom", roomName);
//    divRoomConfig.classList.add("d-none");
//    roomDiv.classList.remove("d-none");
//  }
//};
//
//const handleSocketEvent = (eventName, callback) => socket.on(eventName,
//    callback);
//
//handleSocketEvent("created", e => {
//  console.log("Room created, requesting camera access...");
//  navigator.mediaDevices.getUserMedia(streamConstraints).then(stream => {
//    console.log("Camera access granted!");
//
//    // Log what settings we actually got
//    const videoTrack = stream.getVideoTracks()[0];
//    const settings = videoTrack.getSettings();
//    console.log("Camera settings:", settings);
//    console.log(`Resolution: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
//
//    localStream = stream;
//    localVideo.srcObject = stream;
//    localVideo.muted = true;
//    isCaller = true;
//  }).catch(error => {
//    console.error("Camera error:", error);
//    alert(`Camera access failed: ${error.name} - ${error.message}`);
//  });
//});
//
//handleSocketEvent("joined", e => {
//  console.log("Joined room, requesting camera access...");
//  navigator.mediaDevices.getUserMedia(streamConstraints).then(stream => {
//    console.log("Camera access granted!");
//
//    // Log what settings we actually got
//    const videoTrack = stream.getVideoTracks()[0];
//    const settings = videoTrack.getSettings();
//    console.log("Camera settings:", settings);
//    console.log(`Resolution: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
//
//    localStream = stream;
//    localVideo.srcObject = stream;
//    localVideo.muted = true;
//    socket.emit("ready", roomName);
//  }).catch(error => {
//    console.error("Camera error:", error);
//    alert(`Camera access failed: ${error.name} - ${error.message}`);
//  });
//});
//
//handleSocketEvent("candidate", e => {
//  if (rtcPeerConnection) {
//    const candidate = new RTCIceCandidate({
//      sdpMLineIndex: e.label, candidate: e.candidate,
//    });
//
//    rtcPeerConnection.onicecandidateerror = (error) => {
//      console.error("Error adding ICE candidate: ", error);
//    };
//
//    if (remoteDescriptionPromise) {
//      remoteDescriptionPromise
//      .then(() => {
//        if (candidate != null) {
//          return rtcPeerConnection.addIceCandidate(candidate);
//        }
//      })
//      .catch(error => console.log(
//          "Error adding ICE candidate after remote description: ", error));
//    }
//  }
//});
//
//handleSocketEvent("ready", e => {
//  if (isCaller) {
//    rtcPeerConnection = new RTCPeerConnection(iceServers);
//    rtcPeerConnection.onicecandidate = onIceCandidate;
//    rtcPeerConnection.ontrack = onAddStream;
//
//    // Add tracks properly - separate video and audio
//    localStream.getTracks().forEach(track => {
//      console.log("Adding track:", track.kind);
//      rtcPeerConnection.addTrack(track, localStream);
//    });
//
//    rtcPeerConnection
//    .createOffer()
//    .then(sessionDescription => {
//      rtcPeerConnection.setLocalDescription(sessionDescription);
//      socket.emit("offer", {
//        type: "offer", sdp: sessionDescription, room: roomName,
//      });
//      // Apply bitrate limits after offer is created
//      applyBitrateLimit(rtcPeerConnection);
//      // monitorConnectionQuality(rtcPeerConnection); // Disabled - adds overhead
//    })
//    .catch(error => console.log(error));
//  }
//});
//
//handleSocketEvent("offer", e => {
//  if (!isCaller) {
//    rtcPeerConnection = new RTCPeerConnection(iceServers);
//    rtcPeerConnection.onicecandidate = onIceCandidate;
//    rtcPeerConnection.ontrack = onAddStream;
//
//    // Add tracks properly - separate video and audio
//    localStream.getTracks().forEach(track => {
//      console.log("Adding track:", track.kind);
//      rtcPeerConnection.addTrack(track, localStream);
//    });
//
//    if (rtcPeerConnection.signalingState === "stable") {
//      remoteDescriptionPromise = rtcPeerConnection.setRemoteDescription(
//          new RTCSessionDescription(e));
//      remoteDescriptionPromise
//      .then(() => {
//        return rtcPeerConnection.createAnswer();
//      })
//      .then(sessionDescription => {
//        rtcPeerConnection.setLocalDescription(sessionDescription);
//        socket.emit("answer", {
//          type: "answer", sdp: sessionDescription, room: roomName,
//        });
//        // Apply bitrate limits after answer is created
//        applyBitrateLimit(rtcPeerConnection);
//        // monitorConnectionQuality(rtcPeerConnection); // Disabled - adds overhead
//      })
//      .catch(error => console.log(error));
//    }
//  }
//});
//
//handleSocketEvent("answer", e => {
//  if (isCaller && rtcPeerConnection.signalingState === "have-local-offer") {
//    remoteDescriptionPromise = rtcPeerConnection.setRemoteDescription(
//        new RTCSessionDescription(e));
//    remoteDescriptionPromise.catch(error => console.log(error));
//  }
//});
//
//handleSocketEvent("userDisconnected", (e) => {
//  remoteVideo.srcObject = null;
//  isCaller = true;
//});
//
//handleSocketEvent("setCaller", callerId => {
//  isCaller = socket.id === callerId;
//});
//
//handleSocketEvent("full", e => {
//  alert("room is full!");
//  window.location.reload();
//});
//
//const onIceCandidate = e => {
//  if (e.candidate) {
//    console.log("sending ice candidate");
//    socket.emit("candidate", {
//      type: "candidate",
//      label: e.candidate.sdpMLineIndex,
//      id: e.candidate.sdpMid,
//      candidate: e.candidate.candidate,
//      room: roomName,
//    });
//  }
//}
//
//const onAddStream = e => {
//  remoteVideo.srcObject = e.streams[0];
//  remoteStream = e.stream;
//}