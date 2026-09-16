const PANDEY_API = "https://pandey.5911-shivamyadav.workers.dev";

let sessionToken = null;

const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");

const passwordInput = document.getElementById("passwordInput");
const loginButton = document.getElementById("loginButton");
const loginStatus = document.getElementById("loginStatus");

const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const logoutButton = document.getElementById("logoutButton");
const statusElement = document.getElementById("status");

const conversationId =
  localStorage.getItem("pandey_conversation_id") ||
  crypto.randomUUID();

localStorage.setItem(
  "pandey_conversation_id",
  conversationId
);


// -------------------------
// LOGIN
// -------------------------

loginButton.addEventListener("click", login);

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    login();
  }
});

async function login() {
  const password = passwordInput.value.trim();

  if (!password) {
    loginStatus.textContent = "Enter your password.";
    return;
  }

  loginButton.disabled = true;
  loginStatus.textContent = "Logging in...";

  try {
    const response = await fetch(`${PANDEY_API}/v1/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Login failed.");
    }

    sessionToken = data.session_token;

    loginStatus.textContent = "Login successful.";

    passwordInput.value = "";

    loginScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");

    statusElement.textContent = "Online";

    addMessage(
      "Pandey",
      "Hello. I am ready."
    );

    messageInput.focus();

  } catch (error) {
    console.error(error);

    loginStatus.textContent =
      error.message || "Login failed.";

  } finally {
    loginButton.disabled = false;
  }
}


// -------------------------
// CHAT
// -------------------------

sendButton.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

async function sendMessage() {
  const text = messageInput.value.trim();

  if (!text) {
    return;
  }

  if (!sessionToken) {
    addMessage(
      "System",
      "Please log in first."
    );
    return;
  }

  addMessage("You", text);

  messageInput.value = "";

  sendButton.disabled = true;
  messageInput.disabled = true;

  const thinkingMessage = addMessage(
    "Pandey",
    "Thinking..."
  );

  try {
    const response = await fetch(
      `${PANDEY_API}/v1/chat`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },

        body: JSON.stringify({
          conversation_id: conversationId,
          message: text
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Request failed."
      );
    }

    thinkingMessage.textContent =
      `Pandey: ${data.reply}`;

  } catch (error) {
    console.error(error);

    thinkingMessage.textContent =
      `Pandey: Error — ${error.message}`;

  } finally {
    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}


// -------------------------
// LOGOUT
// -------------------------

logoutButton.addEventListener("click", logout);

function logout() {
  sessionToken = null;

  chatBox.innerHTML = "";

  chatScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");

  loginStatus.textContent = "";

  passwordInput.value = "";
  passwordInput.focus();

  statusElement.textContent = "Offline";
}


// -------------------------
// CHAT UI
// -------------------------

function addMessage(sender, text) {
  const message = document.createElement("div");

  message.className = "message";

  message.textContent =
    `${sender}: ${text}`;

  chatBox.appendChild(message);

  chatBox.scrollTop =
    chatBox.scrollHeight;

  return message;
}