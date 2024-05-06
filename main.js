var measurement = null;
var acl = null;
var speedCalculator = null;

// Calculates the *first* velocity peak about X axis, or exiting on timeout.
class MaxSpeedCalculator {
  constructor(linearAccel, onresult, onpunchdetected, timeout /*in ms*/) {
    this.accel = linearAccel;
    this.measuring = false;
    this.onresult = onresult;
    this.onpunchdetected = onpunchdetected;
    this.punchDetected = false;
    this.maxSpeed = 0;

    this.vx = 0; // Velocity at time t.
    this.ax = 0; // Acceleration at time t.
    this.t = 0;

    this.timeoutId = 0;
    this.timeout = timeout == null ? 5000 : timeout;

    function onreading() {
      let dt = (this.accel.timestamp - this.t) * 0.001; // In seconds.
      let vx = this.vx + ((this.accel.x + this.ax) / 2) * dt;
      let speed = Math.abs(vx);

      const punchTreashold = 3; // m/s
      if (this.maxSpeed < speed && speed >= punchTreashold) {
        this.maxSpeed = speed;
        if (!this.punchDetected && this.onpunchdetected) {
          this.punchDetected = true;
          this.onpunchdetected();
        }
      }

      if (this.maxSpeed > speed) {
        this.stop();
        this.onresult();
        return;
      }

      this.t = this.accel.timestamp;
      this.ax = this.accel.x;
      this.vx = vx;
    }

    function ontimeout() {
      if (this.measuring) {
        this.stop();
        this.onresult();
      }
    }

    this.onreading = onreading.bind(this);
    this.ontimeout = ontimeout.bind(this);
    this.onerror = this.stop.bind(this);
  }

  get result() {
    const kmPerHourCoef = 3.6;
    return Math.round(this.maxSpeed * kmPerHourCoef);
  }

  start() {
    if (this.accel.timestamp === null) {
      console.error("accelerometer must have initial values");
      return;
    }

    if (this.measuring) {
      console.error("already measuring");
      return;
    }

    this.measuring = true;
    this.maxSpeed = 0;
    this.punchDetected = false;

    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    this.ax = this.accel.x;
    this.ay = this.accel.y;
    this.az = this.accel.z;
    this.t = this.accel.timestamp;

    this.accel.addEventListener("reading", this.onreading);
    this.accel.addEventListener("error", this.onerror);
    this.timeoutId = setTimeout(this.ontimeout, this.timeout);
  }

  stop() {
    this.measuring = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = 0;
    }
    this.accel.removeEventListener("reading", this.onreading);
    this.accel.removeEventListener("error", this.onerror);
  }
}

function onresult() {
  setTimeout(setToInitialState, 1000);
}

function playSound() {
  let el = document.getElementById("sound");
  el.play();
}

function setToInitialState() {
  var shaking = false;

  function onreading() {
    const shakeTreashold = 3 * 9.8;
    const stillTreashold = 1;
    let magnitude = Math.hypot(acl.x, acl.y, acl.z);
    if (magnitude > shakeTreashold) {
      shaking = true;
    } else if (magnitude < stillTreashold && shaking) {
      shaking = false;
      acl.removeEventListener("reading", onreading);
      speedCalculator.start();
    }
  }

  acl.addEventListener("reading", onreading);
}

function startApp() {
  acl = new LinearAccelerationSensor({ frequency: 60 });
  speedCalculator = new MaxSpeedCalculator(acl, onresult, playSound);

  acl.addEventListener("activate", setToInitialState);
  acl.addEventListener("error", (error) => {
    console.log("Cannot fetch data from sensor due to an error.");
  });
  acl.start();
}

if ("LinearAccelerationSensor" in window) {
  navigator.permissions
    .query({ name: "accelerometer" })
    .then((result) => {
      if (result.state != "granted") {
        console.log(
          "Sorry, we're not allowed to access sensors " + "on your device.."
        );
        return;
      }
      startApp();
    })
    .catch((err) => {
      console.log(
        "Integration with Permissions API is not enabled, still try to start"
      );
      startApp();
    });
} else {
  console.log("Your browser doesn't support sensors.");
}

main();
