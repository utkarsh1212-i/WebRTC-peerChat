let APP_ID = "2c53f19a92f9437b830b8493f548eda0";

let token = null; //null becauuse we passed the APP_ID
let uid = String(Math.floor(Math.random() * 100000));

let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId){
    window.location = 'lobby.html'
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

let init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  //index.html?room=22838
  channel = client.createChannel(roomId)
//   channel = client.createChannel("main");
  await channel.join();

  channel.on("MemberJoined", handleUserJoined);
  channel.on("MemberLeft", handleUserLeft);

  client.on("MessageFromPeer", handleMessageFromPeer);

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
  document.getElementById("user-1").srcObject = localStream;
};

let handleUserJoined = async (MemberId) => {
  console.log(MemberId, "joined the channel");
  createOffer(MemberId);
};
let handleUserLeft = async (MemberId) => {
    document.getElementById('user-2').style.display = 'none'

}
let handleMessageFromPeer = async (message, MemberId) => {
  message = JSON.parse(message.text);
  if (message.type === "offer") {
    createAnswer(MemberId, message.offer);
    //peer1 sending offer and peer2 creting answer
  }
  if (message.type === "answer") {
    addAnswer(message.answer); //peer1 setting answer to its remote description
  }
  if (message.type === "candidate") {
    if (peerConnection) {
      peerConnection.addIceCandidate(message.candidate);
    }
  }
};

let createPeerConnection = async (MemberId) => {
  peerConnection = new RTCPeerConnection(servers); //creating offer using webRTC peerconnection method

  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;
  document.getElementById("user-2").style.display = "block";
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    document.getElementById("user-1").srcObject = localStream;
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          }),
        },
        MemberId
      );
    }
  };
};

let createOffer = async (MemberId) => {
  await createPeerConnection(MemberId);

  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "offer", offer: offer }) },
    MemberId
  );
};

// Function for Create Answer forr peer2
let createAnswer = async (MemberId, offer) => {
  await createPeerConnection(MemberId);

  await peerConnection.setRemoteDescription(offer);

  let answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "answer", answer: answer }) },
    MemberId
  );
};

let addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

//function called when peer leave the channel
let leaveChannel = async() => {
    await channel.leave()
    await client.logout()
}

window.addEventListener('beforeunload', leaveChannel); //triggers everytime user closes browser window

init();
