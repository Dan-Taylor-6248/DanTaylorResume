

  
// Get new image from Giphy
// fetch("https://api.giphy.com/v1/gifs/random?api_key=34lFxU4gkser58OdcKNWvcemBOdkWdU6&tag=beavers&rating=g")

fetch("https://api.giphy.com/v1/gifs/random?api_key=34lFxU4gkser58OdcKNWvcemBOdkWdU6&tag=monkeys")
.then(function(response) {
    if (response.status == 200) {
        return response.json();
    }
    else {
        console.log("Whoops, there was a problem...");
    }
    
})
.then(function(jsonData) {
    console.log(jsonData);

    var body = document.querySelector(".project-wrapper");

    var GifURL = jsonData.data.images.original.url;
    var GifTitle = jsonData.data.title;

    // const newSection = document.createElement("section");
    // newSection.classList.add("project-item");

    // const content = `
  
    // <section class="project-item-more">
    //     <img src=${GifURL} srcset = ${GifURL} alt="" width="" height=""></img>
    //     <p>This is a random image from Giphy.com</p>
    //     <p>called "${GifTitle}"</p>
    //     <p>Please enter a filter word in the text box...</p>
    //     <input type="text" class="input-text">
    //     <br></br>
    //     <p>Then click the button below to see a new Giphy...</p>
    //     <!-- link to project -->
    //       <a id="fetch-giphy" class="giphy-button">Load new Giphy!</a>
    // </section>
    // `;
    
    // <a class="btn" href="#" target="_blank">New Giphy</a>

    // newSection.innerHTML = content;
    // body.append(newSection);

})

const container = document.querySelector(".container");
const btn = document.querySelector(".giphy-button");
const button = document.querySelector(".cta-button");
const posX = document.querySelector(".posX span");
const posY = document.querySelector(".posY span");

// Log when the button is clicked in the console.
// btn.addEventListener("click", () => {
//     btn.classList.toggle("active");
//     console.log("Giphy button was clicked!");
//   }, false);

// Log when the button is clicked in the console.
button.addEventListener("click", () => {
    button.classList.toggle("active");
    console.log("Event button was clicked!");
  }, false);



// Update the x and y displays to show the current mouse position.
const mousePosition = (event) => {
    posX.innerText = event.pageX;
    posY.innerText = event.pageY;
};

window.addEventListener("mousemove", mousePosition, false);

// Change the color of the box when the mouse enters.
container.addEventListener(
    "mouseenter",
    () => {
        container.classList.add("green");
    },
    false
);

container.addEventListener(
    "mouseleave",
    () => {
        container.classList.remove("green");
    },
    false
);

// Magic 8 Ball.

$(document).ready(function() {

    var magic8Ball = {};
    magic8Ball.listOfAnswers = ["No", "Yes", "I don't think so...", "Of course!", "Indubitably", "In your dreams."];
  
    $("#answer").hide();
  
    magic8Ball.askQuestion = function(question) {
      $("#8ball").effect("shake");
  
      $("#8ball").attr("src", "https://s3.amazonaws.com/media.skillcrush.com/skillcrush/wp-content/uploads/2016/09/magic8ballAnswer.png");
  
      $("#answer").fadeIn(4000);
  
      var randomNumber = Math.random();
  
      var randomNumberForListOfAnswers = randomNumber * this.listOfAnswers.length;
  
      var randomIndex = Math.floor(randomNumberForListOfAnswers);
  
      var answer = this.listOfAnswers[randomIndex];
  
      $("#answer").text(answer);
  
      console.log(question);
      console.log(answer);
    };
  
    var onClick = function() {
  
      $("#answer").hide();
  
      $("#8ball").attr("src", "https://s3.amazonaws.com/media.skillcrush.com/skillcrush/wp-content/uploads/2016/09/magic8ballQuestion.png");
  
  
      setTimeout(function(){
        var question = prompt("ASK A YES/NO QUESTION!");
        magic8Ball.askQuestion(question);
      }, 500);
  
  
    };
  
    $("#questionButton").click(onClick);
  
  });
