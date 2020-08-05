/* eslint-env browser */
/* eslint "new-cap": "off" */

//declare var MathJax: jax.IMathJax;
declare const renderMathInElement;
//const Prism = require('prismjs');
const accordion = require("./accordion")();

interface Lesson {
  title: string;
  html: HTMLElement;
}

interface Tutorial {
  title: HTMLElement; // <h4> html element
  current: number;
  lessons: Lesson[];
}

let lessonNr = 0;
let tutorialNr = 0;
let tutorials = [];
let firstLoadFlag = true; // true until we show tutorial for the first time.
// Needed because we need to load lesson 0

const updateTutorialNav = function () {
  const prevBtn = document.getElementById("prevBtn") as HTMLButtonElement;
  const nextBtn = document.getElementById("nextBtn") as HTMLButtonElement;
  if (lessonNr > 0) {
    prevBtn.disabled = false;
    prevBtn.onclick = function () {
      loadLesson(tutorialNr, lessonNr - 1);
    };
  } else {
    prevBtn.disabled = true;
    prevBtn.onclick = null;
  }
  if (lessonNr < tutorials[tutorialNr].lessons.length - 1) {
    nextBtn.disabled = false;
    nextBtn.onclick = function () {
      loadLesson(tutorialNr, lessonNr + 1);
    };
  } else {
    nextBtn.disabled = true;
    nextBtn.onclick = null;
  }
  document.getElementById("lessonNr").innerHTML =
    " " + (lessonNr + 1) + "/" + tutorials[tutorialNr].lessons.length;
};

const loadLesson = function (tutorialid: number, lessonid: number) {
  if (tutorialid >= 0 && tutorialid < tutorials.length) {
    tutorialNr = tutorialid;
  }
  if (lessonid >= 0 && lessonid < tutorials[tutorialNr].lessons.length) {
    lessonNr = lessonid;
  }
  const lessonContent = tutorials[tutorialNr].lessons[lessonNr].html;
  const title = tutorials[tutorialNr].title.innerHTML;
  const lesson = document.getElementById("lesson");
  lesson.innerHTML = "<h3>" + title + "</h3>" + lessonContent;
  lesson.scrollTop = 0;
  //  MathJax.Hub.Queue(["Typeset", MathJax.Hub, "#lesson"]);
  // the next line colorized the tutorials
  // $("code").each(function() { this.innerHTML=Prism.highlight(this.textContent,Prism.languages.macaulay2)});

  renderMathInElement(lesson, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
    ],
    macros: {
      "\\PP": "{\\mathbb{P}}",
      "\\ZZ": "{\\mathbb{Z}}",
      "\\QQ": "{\\mathbb{Q}}",
      "\\RR": "{\\mathbb{R}}",
      "\\CC": "{\\mathbb{C}}",
      "\\mac": "\\textsf{Macaulay2}", // can't use italic because KaTeX doesn't know about italic correction
      "\\bold": "{\\bf #1}",
    },
  });
  updateTutorialNav();
};

const loadLessonIfChanged = function (
  tutorialid: number,
  lessonid: number
): void {
  const changedLesson =
    tutorialNr !== tutorialid || lessonNr !== lessonid || firstLoadFlag;
  firstLoadFlag = false;
  if (changedLesson) {
    loadLesson(tutorialid, lessonid);
  }
};

const showLesson = function (e) {
  e.stopPropagation();
  const el = (e.target || e.srcElement) as HTMLElement;
  const lessonIdNr = +el.getAttribute("data-lesson"); // default should be 0
  const tutorialIdNr = +el.getAttribute("data-tutorial");
  console.log("Showing lesson. " + lessonIdNr + " / " + tutorialIdNr);
  loadLessonIfChanged(tutorialIdNr, lessonIdNr);
  document.getElementById("tutorialTitle").click();
  return false;
};

const markdownToTutorial = function (theMD: string) {
  // input: is a simple markdown text, very little is used or recognized:
  // lines beginning with "#": title (and author) of the tutorial
  //   beginning with "##": section name (or "lesson" name)
  //   M2 code is enclosed by ```, on its own line.
  //   mathjax code is allowed.
  // returns an object of class Tutorial
  const theHtml = markdownToHtml(theMD);
  return enrichTutorialWithHtml(theHtml);
};

const enrichTutorialWithHtml = function (theHtml) {
  const result = {
    lessons: [],
    current: 0,
    title: document.createElement("h3"),
  };
  const tutorial = document.createElement("div");
  tutorial.innerHTML = theHtml;
  const children = tutorial.children;
  for (let i = 0; i < children.length; i++) {
    if (children[i].tagName == "TITLE") {
      result.title.innerHTML = children[i].innerHTML;
    } else if (children[i].tagName == "DIV")
      result.lessons.push({
        title: children[i].firstElementChild.innerHTML,
        html: children[i].innerHTML,
      });
  }
  return result;
};

const getTutorial = function (url) {
  return fetch(url, {
    credentials: "same-origin",
  }).then(
    function (response) {
      if (response.status !== 200) {
        throw new Error("Fetching tutorial failed: " + url);
      }
      return response.text();
    },
    function (error) {
      console.log("Error in fetch: " + error);
      throw error;
    }
  );
};

const makeTutorialsList = function (tutorialNames) {
  return Promise.all(tutorialNames.map(getTutorial))
    .then(function (rawTutorials) {
      return rawTutorials.map(enrichTutorialWithHtml);
    })
    .then(function (data) {
      accordion.makeAccordion(data, showLesson);
      tutorials = data;
      loadLessonIfChanged(tutorialNr, lessonNr);
    })
    .catch(function (error) {
      console.log("Error in makeTutorialList: " + error);
    });
};

const markdownToHtml = function (markdownText) {
  const lines = markdownText.split("\n");
  const output = [];
  let inSection = false; // only false until the first ##.  After that, it is true.
  let inExample = false;
  let exampleLines = [];
  const firstLineInExample = false;
  let inPara = false;
  for (const line of lines) {
    if (!inExample && line.match("^##")) {
      if (inPara) {
        output.push("</p>");
        inPara = false;
      }
      if (inSection) {
        output.push("</div>");
      }
      inSection = true;
      output.push("<div><h4>" + line.substring(2) + "</h4>");
    } else if (!inExample && line.match("^#")) {
      output.push("<title>" + line.substring(1) + "</title>");
    } else if (line.match("^ *$")) {
      if (inPara) {
        output.push("</p>");
        inPara = false;
      }
    } else if (line.match("^```")) {
      if (inPara) {
        output.push("</p>");
        inPara = false;
      }
      if (inExample) {
        if (exampleLines.length > 1) {
          output.push("<p><codeblock>" + exampleLines[0]);
          for (let j = 1; j <= exampleLines.length - 2; j++) {
            output.push(exampleLines[j]);
          }
          output.push(
            exampleLines[exampleLines.length - 1] + "</codeblock></p>"
          );
        } else if (exampleLines.length == 1) {
          output.push("<p><code>" + exampleLines[0] + "</code></p>");
        }
        inExample = false;
        exampleLines = [];
      } else {
        inExample = true;
      }
    } else {
      // all other lines
      if (inPara) {
        output.push(line);
      } else if (inExample) {
        exampleLines.push(line);
      } else {
        output.push("<p>" + line);
        inPara = true;
      }
    }
  }
  if (inPara) {
    output.push("</p>");
  }
  if (inSection) {
    output.push("</div>");
  }
  const txt = output.join("\n");
  console.log(txt);
  return txt;
};

const uploadTutorial = function () {
  const files = this.files;
  const file = files[0];
  console.log("file name: " + file.name);
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function (event) {
    const txt = event.target.result;
    const newTutorial = markdownToTutorial(txt as string);
    tutorials.push(newTutorial);
    const lastIndex = tutorials.length - 1;
    const title = newTutorial.title; // this is an <h3>
    const lessons = newTutorial.lessons;
    accordion.appendTutorialToAccordion(
      title,
      "",
      lessons,
      lastIndex,
      showLesson,
      true
    ); // last arg = delete button
  };
  return false;
};

module.exports = function (initialTutorialNr, initialLessonNr) {
  if (initialTutorialNr) tutorialNr = initialTutorialNr;
  if (initialLessonNr) lessonNr = initialLessonNr;
  return {
    showLesson,
    tutorials,
    uploadTutorial,
    makeTutorialsList,
  };
};
