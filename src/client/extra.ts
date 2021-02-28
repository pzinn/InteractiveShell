import Cookie from "cookie";
import { options } from "../common/global";
import { socket, url, myshell, clientId } from "./main";
import { scrollDown, scrollDownLeft, caretIsAtEnd } from "./htmlTools";
import { socketChat, syncChat } from "./chat";
import tutorials from "./tutorials";
import Prism from "prismjs";
import SocketIOFileUpload from "socketio-file-upload";
import { Chat } from "../common/chatClass";
import defaultEditor from "./default.m2"; // TODO retire
import {
  escapeKeyHandling,
  autoCompleteHandling,
  removeAutoComplete,
  delimiterHandling,
  removeDelimiterHighlight,
  autoIndent,
  syntaxHighlight,
} from "./editor";

const setCookie = function (name: string, value: string): void {
  const expDate = new Date(new Date().getTime() + options.cookieDuration);
  document.cookie = Cookie.serialize(name, value, {
    expires: expDate,
  });
};

const getCookie = function (name, deflt?) {
  const cookies = Cookie.parse(document.cookie);
  const cookie = cookies[name];
  return cookie ? cookie : deflt;
};

const getCookieId = function () {
  return getCookie(options.cookieName);
};

const emitReset = function () {
  myshell.reset();
  socket.emit("reset");
};

const attachClick = function (id: string, f) {
  const el = document.getElementById(id);
  if (el) el.onclick = f;
};

const extra = function () {
  let siofu = null;
  const terminal = document.getElementById("terminal");
  const editor = document.getElementById("editorDiv");
  const iFrame = document.getElementById("browseFrame");
  const chatForm = document.getElementById("chatForm");
  const tabs = document.getElementById("tabs") as any;

  const getSelected = function () {
    // similar to trigger the paste event (except for when there's no selection and final \n) (which one can't manually, see below)
    const sel = window.getSelection() as any; // modify is still "experimental"
    if (editor.contains(sel.focusNode)) {
      // only if we're inside the editor
      if (sel.isCollapsed) {
        sel.modify("move", "backward", "lineboundary");
        sel.modify("extend", "forward", "lineboundary");
        const s = sel.toString();
        // sel.modify("move", "forward", "line"); // doesn't work in firefox
        sel.collapseToEnd();
        sel.modify("move", "forward", "character");
        return s;
      } else return sel.toString(); // fragInnerText(sel.getRangeAt(0).cloneContents()); // toString used to fail because ignored BR / DIV which firefox creates
    } else return "";
  };

  const editorEvaluate = function () {
    const msg = getSelected();
    myshell.postMessage(msg, false, false); // important not to move the pointer so can move to next line
    editor.focus(); // in chrome, this.blur() would be enough, but not in firefox
    /*
    const input = msg.split("\n");
    for (var line=0; line<input.length; line++) {
    if ((line<input.length-1)||(msg[msg.length-1]=="\n"))
    myshell.postMessage(input[line], false, false);
    }
    */
    // doesn't work -- feeding line by line is a bad idea, M2 then spits out input twice
    /*
    var dataTrans = new DataTransfer();
    dataTrans.setData("text/plain",msg);
    var event = new ClipboardEvent('paste',{clipboardData: dataTrans});
    document.getElementById("terminal").dispatchEvent(event);
    */
    // sadly, doesn't work either -- cf https://www.w3.org/TR/clipboard-apis/
    // "A synthetic paste event can be manually constructed and dispatched, but it will not affect the contents of the document."
  };

  const clearOut = function () {
    while (terminal.childElementCount > 1)
      terminal.removeChild(terminal.firstChild);
  };

  /*
const toggleWrap = function () {
  const out = document.getElementById("terminal");
  const btn = document.getElementById("wrapBtn");
  btn.classList.toggle("rotated");
  out.classList.toggle("M2Wrapped");
};
  */
  let fileName;

  const fileNameEl = document.getElementById(
    "editorFileName"
  ) as HTMLInputElement;
  const updateFileName = function (newName: string) {
    fileNameEl.value = fileName = newName;
    setCookie(options.cookieFileName, fileName);
  };
  fileNameEl.onchange = function () {
    updateFileName(fileNameEl.value.trim());
  };
  fileNameEl.onkeydown = function (e) {
    if (e.key == "Enter") {
      editor.focus();
      e.preventDefault();
    }
  };

  updateFileName(getCookie(options.cookieFileName, "default.m2"));

  let autoSaveTimeout = 0;
  const autoSave = function () {
    if (autoSaveTimeout) {
      window.clearTimeout(autoSaveTimeout);
      autoSaveTimeout = 0;
    }
    if ((document.getElementById("autoUpload") as HTMLInputElement).checked) {
      const content = editor.innerText as string;
      const file = new File([content], fileName);
      (file as any).auto = true;
      siofu.submitFiles([file]);
    }
  };

  const loadFileProcess = function (event) {
    if (event.target.files.length > 0) {
      const fileToLoad = event.target.files[0];
      updateFileName(fileToLoad.name);
      const fileReader = new FileReader();
      fileReader.onload = function () {
        // var textFromFileLoaded = e.target.result;
        const textFromFileLoaded = fileReader.result;
        editor.innerHTML = Prism.highlight(
          textFromFileLoaded,
          Prism.languages.macaulay2
        );
        document.getElementById("editorTitle").click();
      };
      fileReader.readAsText(fileToLoad, "UTF-8");

      autoSave();
      /*
      if ((document.getElementById("autoUpload") as HTMLInputElement).checked) {
        event.target.files[0].auto = true;
        siofu.submitFiles(event.target.files);
	}
	*/
    }
  };
  const loadFile = function () {
    const dialog = document.createElement("input");
    dialog.setAttribute("type", "file"),
      dialog.addEventListener("change", loadFileProcess, false);
    dialog.click();
  };

  const saveFile = function () {
    const content = editor.innerText as string;

    autoSave(); // may be wrong name!!! same pbl as right below
    const inputLink =
      "data:application/octet-stream," + encodeURIComponent(content);
    const inputParagraph = document.createElement("a");
    inputParagraph.setAttribute("href", inputLink);
    inputParagraph.setAttribute("download", fileName); // reuses the last loaded file name (but not saved!)
    inputParagraph.click();
  };

  let highlightTimeout = 0;
  const delayedAction = function () {
    if (highlightTimeout) window.clearTimeout(highlightTimeout);
    highlightTimeout = window.setTimeout(function () {
      highlightTimeout = 0;
      syntaxHighlight(editor);
    }, 1500);
    autoSaveTimeout = window.setTimeout(autoSave, 30000);
  };

  const attachCtrlBtnActions = function () {
    attachClick("sendBtn", editorEvaluate);
    attachClick("resetBtn", emitReset);
    attachClick("interruptBtn", myshell.interrupt);
    attachClick("saveBtn", saveFile);
    attachClick("loadBtn", loadFile);
    //    attachClick("highlightBtn", highlight);
    attachClick("clearBtn", clearOut);
    //  attachClick("wrapBtn", toggleWrap);
  };

  const showUploadSuccessDialog = function (event) {
    if (!event.file.auto) {
      const dialog = document.getElementById(
        "uploadSuccessDialog"
      ) as HTMLDialogElement;
      // console.log('we uploaded the file: ' + event.success);
      // console.log(event.file);
      const filename = event.file.name;
      // console.log("File uploaded successfully!" + filename);
      const successSentence =
        filename +
        " has been uploaded and you can use it by loading it into your session.";
      document.getElementById(
        "uploadSuccessDialogContent"
      ).innerText = successSentence;
      dialog.showModal();
    }
  };

  const attachCloseDialogBtns = function () {
    attachClick("uploadSuccessDialogClose", function () {
      (document.getElementById("uploadSuccessDialog") as any).close();
    });
    attachClick("showFileDialogClose", function () {
      (document.getElementById("showFileDialog") as any).close();
    });
  };

  const attachMinMaxBtnActions = function () {
    const dialog: any = document.getElementById("fullScreenOutput");
    if (dialog) {
      const maximize = document.getElementById("maximizeOutput");
      const downsize = document.getElementById("downsizeOutput");
      const zoomBtns = document.getElementById("terminalZoomBtns");
      const output = document.getElementById("terminal");
      dialog.onclose = function () {
        const oldPosition = document.getElementById("right-half");
        const ctrl = document.getElementById("terminalCtrlBtns");
        oldPosition.appendChild(output);
        ctrl.insertBefore(zoomBtns, maximize);
        scrollDownLeft(output);
      };
      attachClick("maximizeOutput", function () {
        const maxCtrl = document.getElementById("terminalCtrlBtnsMax");
        /*    if (!dialog.showModal) {
		  dialogPolyfill.registerDialog(dialog);
		  }*/
        dialog.appendChild(output);
        maxCtrl.insertBefore(zoomBtns, downsize);
        dialog.showModal();
        output.focus();
        scrollDownLeft(output);
      });
      attachClick("downsizeOutput", function () {
        dialog.close();
      });
    }
  };

  const editorKeyDown = function (e) {
    //    var prismInvoked=false;
    removeAutoComplete(false, true); // remove autocomplete menu if open and move caret to right after
    removeDelimiterHighlight(editor);
    if (e.key == "Enter" && e.shiftKey) {
      if (!caretIsAtEnd()) e.preventDefault();
      const msg = getSelected();
      myshell.postMessage(msg, false, false);
    } else if (e.key == "Escape") escapeKeyHandling();
    else if (e.key == "Tab") {
      // try to avoid disrupting the normal tab use as much as possible
      if (!e.shiftKey && autoCompleteHandling(editor)) {
        e.preventDefault();
        return;
      }
    }
  };

  const editorKeyUp = function (e) {
    if (e.key == "Enter" && !e.shiftKey) autoIndent(editor);
    else delimiterHandling(e.key, editor);
  };

  const queryCookie = function () {
    const id = getCookieId();
    let msg: string = id
      ? "The user id stored in your cookie is: " + id.substring(4)
      : "You don't have a cookie.";
    if (clientId != id)
      msg += "\nYour temporary id is: " + clientId.substring(4);
    alert(msg);
  };

  // zoom
  function sanitizeFactor(factor) {
    let result = factor;
    if (result < 0) {
      result *= -1;
    }
    if (result === 0) {
      result += 1.1;
    }
    if (result < 1) {
      result = 1 / result;
    }
    return result;
  }

  const attachZoomButtons = function (
    textareaID,
    zoominID,
    resetID,
    zoomoutID,
    inputFactorOrDefault?
  ) {
    const inputFactor =
      typeof inputFactorOrDefault === "undefined"
        ? 1.1
        : sanitizeFactor(inputFactorOrDefault);
    const sizes = {
      factor: inputFactor,
      currentSize: 1.0,
    };
    const textarea = document.getElementById(textareaID);
    function applySize() {
      const sizePercent = Math.round(sizes.currentSize * 100);
      textarea.style.fontSize = sizePercent.toString() + "%";
    }

    const zoomin = function () {
      sizes.currentSize *= sizes.factor;
      console.log("zoom: " + sizes.currentSize);
      applySize();
    };

    const zoomout = function () {
      sizes.currentSize /= sizes.factor;
      console.log("zoom: " + sizes.currentSize);
      applySize();
    };

    const reset = function () {
      sizes.currentSize = 1.0;
      console.log("zoom: " + sizes.currentSize);
      applySize();
    };

    attachClick(zoominID, zoomin);
    attachClick(zoomoutID, zoomout);
    attachClick(resetID, reset);
  };

  socket.on("chat", socketChat);

  if (chatForm) {
    const chatInput = document.getElementById("chatInput") as HTMLInputElement;
    const chatAlias = document.getElementById("chatAlias") as HTMLInputElement;
    // init alias as cookie or default
    chatAlias.value = getCookie(options.cookieAliasName, options.defaultAlias);
    chatAlias.onchange = function () {
      const alias = chatAlias.value.trim();
      chatAlias.value =
        alias === options.adminAlias ||
        alias === options.systemAlias ||
        alias.indexOf("/") >= 0 ||
        alias.indexOf(",") >= 0
          ? options.defaultAlias
          : alias;
      setCookie(options.cookieAliasName, chatAlias.value);
    };
    document.getElementById("pmto").onkeydown = chatAlias.onkeydown = function (
      e
    ) {
      if (e.key == "Enter") {
        chatInput.focus();
        e.preventDefault();
      }
    };

    chatInput.onkeypress = function (e) {
      if (e.key == "Enter" && !e.shiftKey) {
        e.preventDefault();
        const txt = chatInput.innerText; // or textContent?
        if (txt != "") {
          const msg: Chat = {
            type: "message",
            alias: chatAlias.value,
            message: txt,
            time: Date.now(),
          };
          if (
            (document.getElementById("pmtoggle") as HTMLInputElement).checked
          ) {
            msg.recipients = {};
            // parse list of recipients
            (document.getElementById("pmto") as HTMLInputElement).value
              .split(",")
              .forEach(function (rec: string) {
                const i = rec.indexOf("/");
                const id = i < 0 ? "" : "user" + rec.substring(0, i);
                const alias = i < 0 ? rec : rec.substring(i + 1);
                if ((id != "" || alias != "") && msg.recipients[id] !== null) {
                  // null means everyone
                  if (alias === "") msg.recipients[id] = null;
                  else {
                    if (msg.recipients[id] === undefined)
                      msg.recipients[id] = [];
                    msg.recipients[id].push(alias);
                  }
                }
              });
          } else msg.recipients = { "": null }; // to everyone

          socket.emit("chat", msg);
          chatInput.textContent = "";
        }
      }
    };
    // signal presence
    //    window.addEventListener("load", function () {
    syncChat();
    //    });
  }

  attachZoomButtons(
    "terminal",
    "terminalZoomIn",
    "terminalResetZoom",
    "terminalZoomOut"
  );

  // chat pm
  attachClick("pmtoggle", function () {
    (document.getElementById("pmto") as HTMLInputElement).disabled = !this
      .checked;
  });

  // starting text in editor
  const xhr = new XMLHttpRequest();
  xhr.open("GET", fileName + "?id=" + clientId + "&relative=true", true);
  xhr.onload = function (e) {
    const text =
      xhr.readyState === 4 && xhr.status === 200
        ? xhr.responseText
        : defaultEditor;
    editor.innerHTML = Prism.highlight(text, Prism.languages.macaulay2);
  }; // have defaultEditor on docker anyway?
  xhr.send(null);

  let tab = url.hash;

  //  const loadtute = url.searchParams.get("loadtutorial");
  const m = /^#tutorial(?:-(\d*))?(?:-(\d*))?$/.exec(tab);
  let tute = 0,
    page = 1;
  if (m) {
    tute = +m[1] || 0;
    page = +m[2] || 1;
  }
  const tutorialManager = tutorials(tute, page - 1);
  const upTutorial = document.getElementById("uptutorial");
  if (upTutorial) {
    upTutorial.onchange = tutorialManager.uploadTutorial;
  }

  // supersedes mdl's internal tab handling
  const openTab = function () {
    let loc = document.location.hash.substring(1);
    // new syntax for navigating tutorial
    const m = /^tutorial(?:-(\d*))?(?:-(\d*))?$/.exec(loc);
    if (m) {
      loc = "tutorial";
      if (m[1] || m[2])
        tutorialManager.loadLessonIfChanged(+m[1] || 0, (+m[2] || 1) - 1);
    }
    const panel = document.getElementById(loc);
    if (panel) {
      const tab = document.getElementById(loc + "Title");
      if (tabs.MaterialTabs) {
        tabs.MaterialTabs.resetPanelState_();
        tabs.MaterialTabs.resetTabState_();
      }
      panel.classList.add("is-active");
      tab.classList.add("is-active");
      if (loc == "chat") {
        tab.removeAttribute("data-message");
        // scroll. sadly, doesn't work if started with #chat
        const ul = document.getElementById("chatMessages");
        scrollDown(ul);
      }
    }
  };

  let ignoreFirstLoad = true;
  const openBrowseTab = function (event) {
    const el = document.getElementById("browseTitle");
    // show tab panel
    if (el && tabs.classList.contains("is-upgraded")) {
      if (ignoreFirstLoad) ignoreFirstLoad = false;
      else el.click();
    }
    // try to enable actions
    const iFrame = document.getElementById("browseFrame") as HTMLIFrameElement;
    if (iFrame && iFrame.contentDocument && iFrame.contentDocument.body) {
      const bdy = iFrame.contentDocument.body;
      bdy.onclick = document.body.onclick;
      bdy.onkeydown = document.body.onkeydown;
      bdy.onmousedown = document.body.onmousedown;
      bdy.oncontextmenu = document.body.oncontextmenu;
    }
    // do not follow link
    event.preventDefault();
  };

  if (tabs) {
    document.location.hash = "";
    window.addEventListener("hashchange", openTab);
    if (tab === "")
      //      if (loadtute) tab = "#tutorial";
      //	else
      tab = "#home";
    document.location.hash = tab;
  }

  attachMinMaxBtnActions();
  attachCtrlBtnActions();
  attachCloseDialogBtns();

  if (editor) {
    editor.onkeydown = editorKeyDown;
    editor.onkeyup = editorKeyUp;
    editor.oninput = delayedAction;
  }

  siofu = new SocketIOFileUpload(socket);
  attachClick("uploadBtn", siofu.prompt);
  siofu.addEventListener("complete", showUploadSuccessDialog);

  window.addEventListener("beforeunload", autoSave);

  if (iFrame) iFrame.onload = openBrowseTab;

  const cookieQuery = document.getElementById("cookieQuery");
  if (cookieQuery) cookieQuery.onclick = queryCookie;
};

export { extra, setCookie, getCookieId };
