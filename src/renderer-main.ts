import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderer, DirectionalLight , Vector2, Vector3, ArrowHelper, Group, BufferAttribute, Line, BufferGeometry,LineBasicMaterial} from 'THREE';
import Stats = require('stats.js');

const dialog = require('electron').remote.dialog;
var fs = require('fs'); // Load the File System to execute our common tasks (CRUD)

const Meyda = require('meyda');

const {createSongUri} = require("electron-audio-conversion");

interface WriteableArrayLike<T> {
  readonly length: number;
  [n: number]: T;
}

const bufferSize = 1024;

console.log("Meyda",Meyda);
console.log("dialog",dialog);
initApp();


function initializeFFTs(count:Number, pointCount: number) {
  var ffts:number[][] = [];
  for (var i = 0; i < count; i++) {
    ffts.push(Array.apply(null, Array(pointCount)).map(Number.prototype.valueOf, 0));
  }

  return ffts;
};


function initAudio(audioFeatureCallback: Function) {
  const audioContext = new AudioContext();
  console.log("audioContext",audioContext);

  dialog.showOpenDialog({properties: ['openFile', 'openDirectory', 'multiSelections']}, 
  async (files) => {
    console.log("loading song",files[0])
    const song = await createSongUri(files[0],"audio/mp3");
    console.log("loaded song");
    var tune = new Audio(song);
    // tune.controls = true;
    var source = audioContext.createMediaElementSource(tune);
    source.connect(audioContext.destination)
    const meydaAnalyzer = Meyda.createMeydaAnalyzer({
      "audioContext":audioContext, // required
      "source":source, // required
      bufferSize, // required
      // "hopSize": 256, // optional
      // "windowingFunction": "hamming", // optional
      windowingFunction: 'blackman',// optional - A string, or an array of strings containing the names of features you wish to extract.
      "callback": (features) => audioFeatureCallback(features) // optional callback in which to receive the features fo
    });
    





     meydaAnalyzer.start(['amplitudeSpectrum', 'powerSpectrum','spectralCentroid', 'spectralRolloff', 'loudness', 'rms','mfcc']);
     tune.addEventListener("ended",() => {
       console.log("ended");
       meydaAnalyzer.stop();
    })
    tune.muted = false;
    tune.volume=0.2;
    tune.play();
    console.log("audio", tune);
  });


}

function initApp() {
  console.log('App initialized!');

  /* stats */
  let stats = new Stats();
  document.body.appendChild(stats.dom);
  stats.showPanel(0);

  let scene, camera, renderer;
  let geometry,mesh;
  var material = new LineBasicMaterial({
    color: 0xffffff,
    transparent:true,
    opacity:0.9
  });

  // var yellowMaterial = LineBasicMaterial({
  //   color: 0x00ffff
  // });
  const width=512;
  const height=512;
  var ffts = initializeFFTs(5, bufferSize);
  init();
  animate();
  function smooth(smoothingUp:number, smoothingDown:number) {
    let smoothedValues:number[] = null;
    return function smooth(newValues:number[]) {
      if (smoothedValues === null)
        smoothedValues = newValues;
      else {
        smoothedValues = smoothedValues.map((smoothedVal, i) => {
          const newVal:number = newValues[i];
          const smoothing = newVal > smoothedVal ? smoothingUp : smoothingDown;
          return (1-smoothing) * newVal + smoothing*smoothedVal;
        })
        return smoothedValues;
      }
    }
  }
  function init() {



    var aspectRatio = 1/1;
    var scene = new Scene();
    var camera = new PerspectiveCamera(40, aspectRatio, 0.1, 1000);
    camera.aspect = aspectRatio;
    camera.updateProjectionMatrix();
    var directionalLight = new DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);
  
    camera.position.z = 10;
  
    // Unchanging variables
    var length = 1;
    var hex = 0xffff00;
    var dir = new Vector3(0, 1, 0);
    var rightDir = new Vector3(1, 0, 0);
    var origin = new Vector3(1, -6, -15);
  
    // Variables we update
    var centroidArrow = new ArrowHelper(dir, origin, length, hex);
    var rolloffArrow = new ArrowHelper(dir, origin, length, 0x0000ff);
    var rmsArrow = new ArrowHelper(rightDir, origin, length, 0xff00ff);
    var lines = new Group(); // Lets create a seperate group for our lines
    // let loudnessLines = new Group();
    scene.add(centroidArrow);
    scene.add(rolloffArrow);
    scene.add(rmsArrow);


    
  // Render Spectrogram
  for (var i = 0; i < ffts.length; i++) {
    if (ffts[i]) {
      var geometry = new BufferGeometry(); // May be a way to reuse this

      var positions = new Float32Array(ffts[i].length * 3);

      geometry.addAttribute('position', new BufferAttribute(positions, 3));
      geometry.setDrawRange(0, ffts[i].length);
      
      var line = new Line(geometry, material);
      lines.add(line);

      // positions = (<BufferGeometry>line.geometry).getAttribute("position").array;
    }
  }



  var bufferLineGeometry = new BufferGeometry();
  var bufferLine = new Line(bufferLineGeometry, material);
  {
    var _positions = new Float32Array(bufferSize * 3);
    bufferLineGeometry.addAttribute('position', new BufferAttribute(_positions, 3));
    bufferLineGeometry.setDrawRange(0, bufferSize);

    // _positions = (<BufferGeometry>bufferLine.geometry).getAttribute("position").array;
  }
  scene.add(bufferLine);
  scene.add(lines);
  const canvas = <HTMLCanvasElement> document.getElementById("web-gl-canvas")
    renderer = new WebGLRenderer({
      canvas
    });
    renderer.setSize(width, height);

    document.body.appendChild(renderer.domElement);
    let renderedFrame=0;
    function pad(a,b){return(1e15+a+"").slice(-b)}

    const smoother=smooth(0.2,0.7)
    function render(features) {
      stats.begin();
      // const features = a.get(['amplitudeSpectrum', 'spectralCentroid', 'spectralRolloff', 'loudness', 'rms']);
      if (features) {
        console.log(features)
        ffts.pop();
        ffts.unshift(smoother(features.powerSpectrum));
        // var windowedSignalBuffer = a.meyda._m.signal;
  
        for (var _i = 0; _i < ffts.length; _i++) {
          var positions:WriteableArrayLike<number> = (<BufferAttribute>(<BufferGeometry>(<Line>lines.children[_i]).geometry).getAttribute("position")).array;
          var index = 0;
  
          for (var j = 0; j < ffts[_i].length * 3; j++) {
            positions[index++] = 10.7 + 7 * Math.log10(j / ffts[_i].length);
            positions[index++] = 5+4 * Math.log10(ffts[_i][j]);
            positions[index++] = -15 - _i;
          }
  
          (<BufferAttribute>(<BufferGeometry>(<Line>lines.children[_i]).geometry).getAttribute("position")).needsUpdate = true;
        }
  
        // Render Spectral Centroid Arrow
        if (features.spectralCentroid) {
          // SpectralCentroid is an awesome variable name
          // We're really just updating the x axis
          centroidArrow.position.set(10.7 + 8 * Math.log10(features.spectralCentroid / (bufferSize / 2)), -6, -15);
        }
  
        // Render Spectral Rolloff Arrow
        if (features.spectralRolloff) {
          // We're really just updating the x axis
          var rolloff = features.spectralRolloff / 22050;
          rolloffArrow.position.set(10.7 + 8 * Math.log10(rolloff), -6, -15);
        }
        // Render RMS Arrow
        if (features.rms) {
          // We're really just updating the y axis
          rmsArrow.position.set(-11, -5 + 10 * features.rms, -15);
        }
  
        // if (windowedSignalBuffer) {
        //   // Render Signal Buffer
        //   var _positions2 = bufferLine.geometry.attributes.position.array;
        //   var _index = 0;
        //   for (var i = 0; i < bufferSize; i++) {
        //     _positions2[_index++] = -11 + 22 * i / bufferSize;
        //     _positions2[_index++] = 4 + windowedSignalBuffer[i] * 5;
        //     _positions2[_index++] = -25;
        //   }
        //   bufferLine.geometry.attributes.position.needsUpdate = true;
        // }
  
        // // Render loudness
        // if (features.loudness && features.loudness.specific) {
        //   for (var i = 0; i < features.loudness.specific.length; i++) {
        //     let geometry = new THREE.Geometry();
        //     geometry.vertices.push(new THREE.Vector3(
        //       -11 + 22 * i / features.loudness.specific.length,
        //       -6 + features.loudness.specific[i] * 3,
        //       -15
        //     ));
        //     geometry.vertices.push(new THREE.Vector3(
        //       -11 + 22 * i / features.loudness.specific.length + 22 /
        //       features.loudness.specific.length,
        //       -6 + features.loudness.specific[i] * 3,
        //       -15
        //     ));
        //     loudnessLines.add(new THREE.Line(geometry, yellowMaterial));
        //     geometry.dispose();
        //   }
        // }
  
        // for (let c = 0; c < loudnessLines.children.length; c++) {
        //   loudnessLines.remove(loudnessLines.children[c]); //forEach is slow
        // }
        
      }
  
      // requestAnimationFrame(render);
      renderer.render(scene, camera);

      const base64png = canvas.toDataURL().split(",")[1];
      var buffer = new Buffer(base64png, 'base64');
      fs.writeFile(`/tmp/frames/frame_${pad(renderedFrame++,4)}.png`,buffer);
      stats.end();
    }
    initAudio(render);
  }

  function animate() {

    // stats.begin();

    // mesh.rotation.x += 0.01;
    // mesh.rotation.y += 0.02;

    // renderer.render(scene, camera);

    // stats.end();
    // requestAnimationFrame(animate);
  }

}






