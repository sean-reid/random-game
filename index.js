window.onload = function() {

  var min = document.getElementById("minNumber");
  var max = document.getElementById("maxNumber");
  var latestGuess = document.getElementById("latestGuess");
  var button = document.getElementById("button");
  button.addEventListener("click", bestGuess);

  var guesses = [];

  function diff(A) {
    return A.slice(1).map((v, i) => v - A[i]);
  }

  function bestGuess() {
    if (min.value && max.value) {
      if (latestGuess.value) {
        guesses.push(parseInt(latestGuess.value))
      }
      allNumbers = []
      guesses.forEach((g, i) => allNumbers.push(g));
      allNumbers.push(parseInt(min.value), parseInt(max.value))
      allNumbersSorted = allNumbers.sort(function(a, b){return a - b})
      allNumbersDiffs = diff(allNumbersSorted)
      maxDiff = Math.max.apply(Math, allNumbersDiffs);
      idx = allNumbersDiffs.indexOf(maxDiff)
      guess = Math.round(allNumbersSorted[idx] + maxDiff/2)
      document.getElementById("guess").innerHTML = guess
      console.log(guess)
    }
  }
}

