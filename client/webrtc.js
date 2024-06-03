let localStream;
let localVideo;
let peerConnection;
let remoteVideo;
let serverConnection;
let uuid;
let dataChannel;

const peerConnectionConfig = {
    iceServers: [
        { urls: "stun:stun.stunprotocol.org:3478" },
        { urls: "stun:stun.l.google.com:19302" },
    ],
};

async function pageReady() {
    document
        .getElementById("sendFileButton")
        .addEventListener("click", function () {
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.style.display = "none";
            fileInput.addEventListener("change", function () {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();

                    // Define the size of each chunk
                    const CHUNK_SIZE = 20000; // 16KB

                    // Modify the reader.onload function
                    reader.onload = function (evt) {
                        const arrayBuffer = evt.target.result;
                        const data = new Uint8Array(arrayBuffer);
                        let offset = 0;

                        // While there is data left to send
                        while (offset < data.byteLength) {
                            // Get the next chunk of data
                            const chunk = data.subarray(
                                offset,
                                offset + CHUNK_SIZE
                            );

                            // Create the message
                            const message = {
                                type: "file", // Add a type property
                                name: file.name,
                                data: Array.from(chunk),
                            };

                            // Send the message
                            dataChannel.send(JSON.stringify(message));

                            // Move to the next chunk
                            offset += CHUNK_SIZE;
                        }

                        // Notify the receiver that the file transfer is complete
                        const message = {
                            type: "file-complete",
                            name: file.name,
                        };
                        dataChannel.send(JSON.stringify(message));

                        const chatArea = document.getElementById("chatArea");
                        chatArea.innerHTML =
                            `<div class="my-message">Sent a file: ${file.name}</div>` +
                            chatArea.innerHTML;
                    };

                    reader.onprogress = function (evt) {
                        if (evt.lengthComputable) {
                            const percentComplete =
                                (evt.loaded / evt.total) * 100;
                            if (document.getElementById(file.name) == null) {
                                const chatArea =
                                    document.getElementById("chatArea");
                                chatArea.innerHTML =
                                    `<div id="${
                                        file.name
                                    }" class="my-message">Upload progress: ${Math.round(
                                        percentComplete
                                    )}%</div>` + chatArea.innerHTML;
                            } else {
                                document.getElementById(
                                    file.name
                                ).innerHTML = `Upload progress: ${Math.round(
                                    percentComplete
                                )}%`;
                            }
                        }
                    };

                    reader.readAsArrayBuffer(file);
                }
            });
            document.body.appendChild(fileInput); // Add the file input element to the DOM
            fileInput.click(); // Programmatically click the file input to trigger the file selection dialog
        });
    document
        .getElementById("chatInput")
        .addEventListener("keypress", function (event) {
            if (event.key === "Enter") {
                document.getElementById("sendButton").click();
            }
        });
    document
        .getElementById("codeInput")
        .addEventListener("keypress", function (event) {
            if (event.key === "Enter") {
                enterRoom(document.getElementById("codeInput").value);
                codeInput.value = "";
            }
        });
    uuid = createUUID();

    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    serverConnection = new WebSocket(`wss://${window.location.hostname}:8443`);
    serverConnection.onmessage = gotMessageFromServer;

    document
        .getElementById("sendButton")
        .addEventListener("click", sendChatMessage);

    const constraints = {
        video: true,
        audio: true,
    };

    if (!navigator.mediaDevices.getUserMedia) {
        alert("Your browser does not support getUserMedia API");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        localStream = stream;
        localVideo.srcObject = stream;
    } catch (error) {
        errorHandler(error);
    }
}

function start(isCaller) {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    if (isCaller) {
        dataChannel = peerConnection.createDataChannel("dataChannel");
        dataChannel.onmessage = handleDataChannelMessage;
        dataChannel.onopen = (e) => console.log("open!!!!");
        dataChannel.onclose = (e) => {
            console.log("closed!!!!!!");
            dataChannel = peerConnection.createDataChannel("dataChannel");
        };
        peerConnection
            .createOffer()
            .then(createdDescription)
            .catch(errorHandler);
    } else {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            dataChannel.onmessage = handleDataChannelMessage;
            dataChannel.onopen = (e) => console.log("open!!!!");
            dataChannel.onclose = (e) => console.log("closed!!!!!!");
        };
    }
}

function gotMessageFromServer(message) {
    if (!peerConnection) start(false);

    const signal = JSON.parse(message.data);

    // Ignore messages from ourself
    if (signal.uuid == uuid) return;

    if (signal.sdp) {
        peerConnection
            .setRemoteDescription(new RTCSessionDescription(signal.sdp))
            .then(() => {
                // Only create answers in response to offers
                if (signal.sdp.type !== "offer") return;

                peerConnection
                    .createAnswer()
                    .then(createdDescription)
                    .catch(errorHandler);
            })
            .catch(errorHandler);
    } else if (signal.ice) {
        peerConnection
            .addIceCandidate(new RTCIceCandidate(signal.ice))
            .catch(errorHandler);
    }
}

function gotIceCandidate(event) {
    if (event.candidate != null) {
        serverConnection.send(
            JSON.stringify({ ice: event.candidate, uuid: uuid })
        );
    }
}

function createdDescription(description) {
    console.log("got description");

    peerConnection
        .setLocalDescription(description)
        .then(() => {
            serverConnection.send(
                JSON.stringify({
                    sdp: peerConnection.localDescription,
                    uuid: uuid,
                })
            );
        })
        .catch(errorHandler);
}

function gotRemoteStream(event) {
    console.log("got remote stream");
    remoteVideo.srcObject = event.streams[0];
}

function errorHandler(error) {
    console.log(error);
}

function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4() + s4() + s4()}`;
}

function sendChatMessage() {
    const chatInput = document.getElementById("chatInput");
    const message = chatInput.value;
    if (message.trim() !== "") {
        chatInput.value = "";

        // Send the message over the data channel
        const data = {
            type: "chat", // Add a type property
            message: message,
        };
        dataChannel.send(JSON.stringify(data));

        // Add the message to the chat area
        const chatArea = document.getElementById("chatArea");
        chatArea.innerHTML =
            `<div class="my-message">${message}</div>` + chatArea.innerHTML;
    }
}

let receivedFileChunks = [];
let receivedFileName;

function handleDataChannelMessage(event) {
    const data = JSON.parse(event.data);

    if (data.type === "chat") {
        // Handle chat messages
        const chatArea = document.getElementById("chatArea");
        chatArea.innerHTML =
            `<div class="their-message">${data.message}</div>` +
            chatArea.innerHTML;
    } else if (data.type === "file") {
        // Handle file chunks
        const chunk = new Uint8Array(data.data);
        console.log(
            `Received file chunk: ${chunk.length} bytes` +
                "chunks receiver : " +
                receivedFileChunks.length
        );
        // Append the chunk to the file
        receivedFileChunks.push(chunk);
        receivedFileName = data.name; // Save the file name
    } else if (data.type === "file-complete") {
        // Handle end of file transfer
        const receivedFile = new Blob(receivedFileChunks);
        receivedFileChunks = []; // Clear the array for the next file

        const url = URL.createObjectURL(receivedFile);
        const chatArea = document.getElementById("chatArea");
        chatArea.innerHTML =
            `<div class="their-message"><a href="${url}" download="${data.name}">Download file</a></div>` +
            chatArea.innerHTML;
    }
}

function enterRoom(roomCode) {
    if (roomCode.trim() !== "") {
        serverConnection.send(JSON.stringify({ roomcode: roomCode }));
    }
}

pageReady();
