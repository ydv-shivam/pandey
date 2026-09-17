const PANDEY_API =
  "https://pandey.5911-shivamyadav.workers.dev";

let sessionToken = null;


/* ELEMENTS */

const loginScreen =
  document.getElementById("loginScreen");

const chatScreen =
  document.getElementById("chatScreen");

const loginForm =
  document.getElementById("loginForm");

const passwordInput =
  document.getElementById("passwordInput");

const togglePassword =
  document.getElementById("togglePassword");

const loginButton =
  document.getElementById("loginButton");

const loginStatus =
  document.getElementById("loginStatus");

const chatBox =
  document.getElementById("chatBox");

const welcomePanel =
  document.getElementById("welcomePanel");

const messageInput =
  document.getElementById("messageInput");

const sendButton =
  document.getElementById("sendButton");

const logoutButton =
  document.getElementById("logoutButton");

const statusElement =
  document.getElementById("status");

const cloudStatus =
  document.getElementById("cloudStatus");

const sidebarCloudStatus =
  document.getElementById("sidebarCloudStatus");

const activityBar =
  document.getElementById("activityBar");

const activityText =
  document.getElementById("activityText");

const toolIndicator =
  document.getElementById("toolIndicator");

const sidebar =
  document.getElementById("sidebar");

const sidebarBackdrop =
  document.getElementById("sidebarBackdrop");

const openSidebar =
  document.getElementById("openSidebar");

const closeSidebar =
  document.getElementById("closeSidebar");

const toast =
  document.getElementById("toast");


/* CONVERSATION */

const conversationId =
  localStorage.getItem(
    "pandey_conversation_id"
  ) ||
  crypto.randomUUID();

localStorage.setItem(
  "pandey_conversation_id",
  conversationId
);


/* LOGIN */

loginForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();
    login();
  }
);


passwordInput.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Enter") {
      login();
    }
  }
);


togglePassword.addEventListener(
  "click",
  () => {

    const isPassword =
      passwordInput.type === "password";

    passwordInput.type =
      isPassword
        ? "text"
        : "password";

    togglePassword.textContent =
      isPassword
        ? "◌"
        : "◉";

    togglePassword.setAttribute(
      "aria-label",
      isPassword
        ? "Hide password"
        : "Show password"
    );
  }
);


async function login() {

  const password =
    passwordInput.value.trim();

  if (!password) {

    loginStatus.textContent =
      "Enter your password.";

    return;
  }

  loginButton.disabled = true;

  loginStatus.textContent =
    "Connecting to Pandey…";


  try {

    const response =
      await fetch(
        `${PANDEY_API}/v1/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            password
          })
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Login failed."
      );
    }


    sessionToken =
      data.session_token;


    loginStatus.textContent =
      "";

    passwordInput.value =
      "";


    loginScreen.classList.add(
      "hidden"
    );

    chatScreen.classList.remove(
      "hidden"
    );


    setOnlineState(true);


    if (chatBox.children.length === 0) {

      addMessage(
        "Pandey",
        "Hello. I am ready."
      );
    }


    messageInput.focus();

  } catch (error) {

    console.error(error);

    loginStatus.textContent =
      error.message ||
      "Login failed.";

    setOnlineState(false);

  } finally {

    loginButton.disabled =
      false;
  }
}


/* CHAT */

sendButton.addEventListener(
  "click",
  sendMessage
);


messageInput.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();
    }
  }
);


messageInput.addEventListener(
  "input",
  autoResize
);


async function sendMessage() {

  const text =
    messageInput.value.trim();


  if (!text) {
    return;
  }


  if (!sessionToken) {

    addMessage(
      "System",
      "Please log in first.",
      "system"
    );

    return;
  }


  welcomePanel.classList.add(
    "hidden"
  );


  addMessage(
    "You",
    text,
    "user"
  );


  messageInput.value = "";

  autoResize();


  sendButton.disabled =
    true;

  messageInput.disabled =
    true;


  showActivity(
    "Pandey is thinking…"
  );


  const thinkingMessage =
    addMessage(
      "Pandey",
      "Thinking…",
      "assistant"
    );


  try {

    const response =
      await fetch(
        `${PANDEY_API}/v1/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${sessionToken}`
          },

          body: JSON.stringify({
            conversation_id:
              conversationId,

            message:
              text
          })
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Request failed."
      );
    }


    updateMessage(
      thinkingMessage,
      data.reply ||
        "I received your message."
    );


    if (data.tool_used) {

      const toolName =
        formatToolName(
          data.tool
        );


      toolIndicator.textContent =
        `Tool used · ${toolName}`;


      showActivity(
        `${toolName} completed`
      );


      setTimeout(
        hideActivity,
        1200
      );

    } else {

      toolIndicator.textContent =
        "Cloud AI · Memory active";

      hideActivity();
    }


    setOnlineState(true);


  } catch (error) {

    console.error(error);


    updateMessage(
      thinkingMessage,
      `Error — ${
        error.message ||
        "Something went wrong."
      }`
    );


    toolIndicator.textContent =
      "Connection error";


    hideActivity();

  } finally {

    sendButton.disabled =
      false;

    messageInput.disabled =
      false;

    messageInput.focus();
  }
}


/* LOGOUT */

logoutButton.addEventListener(
  "click",
  logout
);


function logout() {

  sessionToken = null;

  chatBox.innerHTML = "";

  welcomePanel.classList.remove(
    "hidden"
  );

  chatScreen.classList.add(
    "hidden"
  );

  loginScreen.classList.remove(
    "hidden"
  );

  loginStatus.textContent =
    "";

  passwordInput.value =
    "";

  setOnlineState(false);

  passwordInput.focus();
}


/* MESSAGE UI */

function addMessage(
  sender,
  text,
  type = "assistant"
) {

  const message =
    document.createElement(
      "article"
    );

  message.className =
    `message ${type}`;


  const avatar =
    document.createElement(
      "div"
    );

  avatar.className =
    "message-avatar";

  avatar.textContent =
    sender === "You"
      ? "Y"
      : "P";


  const body =
    document.createElement(
      "div"
    );

  body.className =
    "message-body";


  const name =
    document.createElement(
      "div"
    );

  name.className =
    "message-name";

  name.textContent =
    sender;


  const messageText =
    document.createElement(
      "div"
    );

  messageText.className =
    "message-text";

  messageText.textContent =
    text;


  body.appendChild(name);

  body.appendChild(
    messageText
  );

  message.appendChild(
    avatar
  );

  message.appendChild(
    body
  );


  chatBox.appendChild(
    message
  );


  chatBox.scrollTop =
    chatBox.scrollHeight;


  return message;
}


function updateMessage(
  messageElement,
  text
) {

  const textElement =
    messageElement.querySelector(
      ".message-text"
    );


  if (textElement) {

    textElement.textContent =
      text;
  }


  chatBox.scrollTop =
    chatBox.scrollHeight;
}


/* ACTIVITY */

function showActivity(text) {

  activityText.textContent =
    text;

  activityBar.classList.remove(
    "hidden"
  );
}


function hideActivity() {

  activityBar.classList.add(
    "hidden"
  );
}


/* STATUS */

function setOnlineState(
  online
) {

  const value =
    online
      ? "Online"
      : "Offline";


  statusElement.textContent =
    value;

  cloudStatus.textContent =
    value;

  sidebarCloudStatus.textContent =
    value;


  const dots =
    document.querySelectorAll(
      ".status-dot"
    );


  dots.forEach(
    (dot) => {

      dot.style.background =
        online
          ? "var(--success)"
          : "var(--danger)";

      dot.style.boxShadow =
        online
          ? "0 0 0 4px rgba(114, 224, 165, 0.08), 0 0 12px rgba(114, 224, 165, 0.5)"
          : "0 0 0 4px rgba(255, 140, 156, 0.08), 0 0 12px rgba(255, 140, 156, 0.35)";
    }
  );
}


/* TEXTAREA */

function autoResize() {

  messageInput.style.height =
    "auto";

  messageInput.style.height =
    `${Math.min(
      messageInput.scrollHeight,
      150
    )}px`;
}


/* TOOL NAME */

function formatToolName(tool) {

  if (!tool) {
    return "Tool";
  }

  if (
    tool === "getPandeyStatus"
  ) {
    return "Status check";
  }

  if (
    tool === "calculate"
  ) {
    return "Calculator";
  }

  if (
    tool === "webSearch"
  ) {
    return "Web search";
  }

  return tool;
}


/* SIDEBAR */

openSidebar?.addEventListener(
  "click",
  () => {

    sidebar.classList.add(
      "open"
    );

    sidebarBackdrop.classList.remove(
      "hidden"
    );
  }
);


closeSidebar?.addEventListener(
  "click",
  closeMobileSidebar
);


sidebarBackdrop?.addEventListener(
  "click",
  closeMobileSidebar
);


function closeMobileSidebar() {

  sidebar.classList.remove(
    "open"
  );

  sidebarBackdrop.classList.add(
    "hidden"
  );
}


/* NAVIGATION */

document
  .querySelectorAll(
    ".nav-item[data-panel]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".nav-item[data-panel]"
            )
            .forEach(
              (item) => {
                item.classList.remove(
                  "active"
                );
              }
            );


          button.classList.add(
            "active"
          );


          const panel =
            button.dataset.panel;


          if (
            panel !== "chat"
          ) {

            showToast(
              panel === "web"
                ? "Web search is planned for a later stage."
                : `${capitalize(
                    panel
                  )} is planned for a later stage.`
            );
          }


          closeMobileSidebar();
        }
      );
    }
  );


/* SUGGESTIONS */

document
  .querySelectorAll(
    ".suggestion"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          messageInput.value =
            button.dataset.prompt ||
            "";

          autoResize();

          messageInput.focus();
        }
      );
    }
  );


/* SETTINGS */

document
  .getElementById(
    "settingsButton"
  )
  ?.addEventListener(
    "click",
    () => {

      showToast(
        "Settings will be added in a later stage."
      );
    }
  );


/* HELPERS */

function capitalize(value) {

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}


let toastTimer;


function showToast(message) {

  toast.textContent =
    message;

  toast.classList.remove(
    "hidden"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () => {

        toast.classList.add(
          "hidden"
        );

      },
      2600
    );
}


/* INITIAL STATE */

setOnlineState(false);