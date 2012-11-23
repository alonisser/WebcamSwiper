/*global console */
(function() {
  var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                              window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
  window.requestAnimationFrame = requestAnimationFrame;

  var cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame ||
  							 window.webkitCancelAnimationFrame || window.msCancelAnimationFrame;
  window.cancelAnimationFrame = cancelAnimationFrame;
})();

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia ||undefined;
var timer;
var testing = false;
if (toastr.error){ // if using toaster https://github.com/CodeSeven/toastr change alert to toaster.error
	alert = toastr.error;
}
function initializeWebcamSwiper() {
	if (testing) {
		timer = new Date().getTime();
		var loops=0;
	}
	if (navigator.getUserMedia === undefined) {
		if (console !== undefined) {
			console.log("Browser doesn't support getUserMedia");
			return;
		}
	}

	navigator.getUserMedia({video: true}, function (stream) {
		window.webcamSwiperStream = stream;
		window.webcamSwiperOn = true;

		// Create a video element and set its source to the stream from the webcam
		var videoElement = document.createElement("video");
		videoElement.style.display = "none";
		videoElement.autoplay = true;
		document.getElementsByTagName("body")[0].appendChild(videoElement);
		if (window.URL === undefined) {
			window.URL = window.webkitURL;
		}
		videoElement.src = window.URL.createObjectURL(stream);

		// Wait for the video element to initialize
		videoElement.addEventListener("canplay", function() {
			// Now that the video element has been initialized, determine the webcam resolution from it
			var horizontalResolution = videoElement.videoWidth;
			var verticalResolution = videoElement.videoHeight;

			if (horizontalResolution < 1 || horizontalResolution > 4000) {
				alert("Webcam error.  Try reloading the page.");
			}

			var canvasWidth = horizontalResolution > 320 ? 320 : horizontalResolution;
			var canvasHeight = verticalResolution > 240 ? 240 : verticalResolution;

			// Create the canvas that we will draw to
			var greyScaleCnvs = document.createElement("canvas");
			greyScaleCnvs.width = canvasWidth;
			greyScaleCnvs.height = canvasHeight;
			var greyscaleCtx = greyScaleCnvs.getContext("2d");
			var currentImageData = greyscaleCtx.createImageData(canvasWidth, canvasHeight);


			// Initialize some variables we will reference each frame
			var isActive = false;
			var remainingFrames = 14;
			var PIXEL_CHANGE_THRESHOLD = 30;
			var FRAME_THRESHOLD = 15000;
			var originalWeight = 0;

			var theLightLevel = 0;
			var scanCount = 0;
			var frameAnalysisTime = 36;

			// every ?th of a second, sample the video stream
			window.webcamSwiperInterval = setInterval(analyzeCurrentFrame, 1000/28);


			function analyzeCurrentFrame() {
				// Start the timer
				var startTime = new Date().getTime()

				scanCount++;

				var previousImageData = currentImageData;

				// Draw the current video frame onto a canvas so we can desaturate the image
				greyscaleCtx.drawImage(videoElement, 0, 0, horizontalResolution, verticalResolution, 0, 0, canvasWidth, canvasHeight);

				// Desaturate it
				var deSaturated = deSaturate(greyscaleCtx.getImageData(0, 0, canvasWidth, canvasHeight));
				currentImageData = deSaturated.pop();

				// Make adjustments for light level and system speed
				if (scanCount % 50 === 0) {
					// Calibrate based on the current light level, if we haven't already
					theLightLevel = deSaturated.pop();
					if (theLightLevel > 0 && theLightLevel <= 1) {
						PIXEL_CHANGE_THRESHOLD = 25;
						FRAME_THRESHOLD = 3000;
					}
					else if (theLightLevel > 1 && theLightLevel < 3) {
						PIXEL_CHANGE_THRESHOLD = 28;
						FRAME_THRESHOLD = 6000;
					}
					else {
						PIXEL_CHANGE_THRESHOLD = 30;
						FRAME_THRESHOLD = 15000;
					}

					// Adjust frame scan rate if needed
					if (frameAnalysisTime > 36) {
						clearInterval(window.webcamSwiperInterval);
						window.webcamSwiperInterval = setInterval(analyzeCurrentFrame, 1000 / (frameAnalysisTime * 2)); // Add some buffer
					}
				}

				// Map the pixels that are changing

				var currentWeight = getMotionWeight(previousImageData, currentImageData, PIXEL_CHANGE_THRESHOLD, canvasWidth);

				// If we aren't actively looking for a spike the opposite direction, check if we should start
				if (!isActive) {
					if (Math.abs(currentWeight) > FRAME_THRESHOLD) {
						isActive = true;
						remainingFrames = 8;
						originalWeight = currentWeight;
					}
				}

				// If we are actively looking for a spike, see if it has occurred within the allowed number of frames
				if (isActive) {
					if (remainingFrames <= 0) {
						isActive = false;
					}
					else {
						remainingFrames--;
						if (originalWeight > 0) {
							//taking the mirror effect into consideration, when I move my hand to the right, my hand on the screen moves to the left of the canvas
							if (currentWeight < -FRAME_THRESHOLD) {
								fireSwipeEvent("webcamSwipeRight");
								console.log("fired right");
								isActive = false;
							}
						}
						else {
							if (currentWeight > FRAME_THRESHOLD) {
								fireSwipeEvent("webcamSwipeLeft");
								isActive = false;
								console.log("fired left");
							}
						}
					}
				}

				// Stop the timer
				var endTime = new Date().getTime();
				frameAnalysisTime = endTime - startTime;

				//console.log(loops);
				if (testing){// works only if testing is set to True
					loops++;
					if (loops%100 === 0) {
						console.log(loops);
					}
					if (loops>300){
						var ender = new Date().getTime();
						timer = ender - timer;
						console.log("10000 loops took: ",timer," ms");
						console.log("time per loop:", timer/loops)
						window.destroyWebcamSwiper();
						console.log("stopped");
					}
				}

			}

		});
	}, function(){ //callback added in case aquiring video stream ("canplay" event) doesn't work
		alert("can't acquire video stream");
	});
}

function getMotionWeight (previous, current, pixel_change_threshold, canvasWidth) {
			// Takes and ImageData and returns it desaturated
			var PIXEL_CHANGE_THRESHOLD = pixel_change_threshold;
			var canvasWidth = canvasWidth;
			var motionWeight = 0;
			var previousData = previous.data;
			var currentData = current.data;
			var dataLength = previousData.length;
			var i = dataLength-8;
			while (i >= 0) {
				if (Math.abs(previousData[i] - currentData[i]) > PIXEL_CHANGE_THRESHOLD) {
						motionWeight += (((i / 4) % canvasWidth) == 0 ? (((i-4) / 4) % canvasWidth) : ((i / 4) % canvasWidth))- (canvasWidth / 2);
				}
				i -= 4;
				//unrolling the loop.. sort of a duff machine making this more efficient
				if (Math.abs(previousData[i] - currentData[i]) > PIXEL_CHANGE_THRESHOLD) {
						motionWeight += (((i / 4) % canvasWidth) == 0 ? (((i-4) / 4) % canvasWidth) : ((i / 4) % canvasWidth))- (canvasWidth / 2);
				}
				i -= 4;
			}
			return motionWeight;
		}
function deSaturate (imageData) {
		var theData = imageData.data;

		var dataLength = theData.length;
		var i = dataLength - 8;
		var lightLevel = 0;
		// Iterate through each pixel, desaturating it
		while ( i >= 0) {
			// To find the desaturated value, average the brightness of the red, green, and blue values

			theData[i] = theData[i+1] = theData[i+2] = (theData[i] + theData[i + 1] + theData[i + 2]) / 3;
			//unrolling the loop.. sort of a duff machine making this more efficient
			theData[i+4] = theData[i+5] = theData[i+6] = (theData[i+4] + theData[i + 5] + theData[i + 6]) / 3;

			// Fully opaque
			theData[i+3] = theData[i + 7] = 255;

			// returning an average intensity of all pixels.  Used for calibrating sensitivity based on room light level.
			lightLevel += theData[i] += theData[i + 4]; //combining the light level in the samefunction

			i -= 8;

		}

		return [lightLevel/(dataLength/4),imageData]
}

function fireSwipeEvent(eventName) {
		var swipeEvent = document.createEvent("UIEvents");
		swipeEvent.initEvent(eventName, false, false);
		document.getElementsByTagName("body")[0].dispatchEvent(swipeEvent);
		//console.log("fired event");
}

function destroyWebcamSwiper() {
	if (window.webcamSwiperInterval !== undefined) {
		clearInterval(window.webcamSwiperInterval);
		window.webcamSwiperInterval = undefined;
	}
	if (window.webcamSwiperStream !== undefined) {
		window.webcamSwiperStream.stop();
		window.webcamSwiperStream = undefined;
	}
	window.webcamSwiperOn = false;
}