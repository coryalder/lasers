const {
    prepareRender,
    drawCommands,
    cameras,
    controls,
    entitiesFromSolids
} = require('@jscad/regl-renderer');

// ********************
// Renderer configuration and initiation.
// ********************

const perspectiveCamera = cameras.perspective
const orbitControls = controls.orbit

const containerElement = document.getElementById("jscad")

const width = containerElement.clientWidth
const height = containerElement.clientHeight

const state = {}

// prepare the camera
state.camera = Object.assign({}, perspectiveCamera.defaults)

perspectiveCamera.setProjection(state.camera, state.camera, { width, height })
perspectiveCamera.update(state.camera, state.camera)

// prepare the controls
state.controls = orbitControls.defaults

// prepare the renderer
const setupOptions = {
  glOptions: { container: containerElement },
}
const renderer = prepareRender(setupOptions)

const gridOptions = {
  visuals: {
    drawCmd: 'drawGrid',
    show: true
  },
  size: [500, 500],
  ticks: [25, 5],
  color: [0, 0, 1, 1],
  subColor: [0, 0, 1, 0.5]
}

const axisOptions = {
  visuals: {
    drawCmd: 'drawAxis',
    show: true
  },
  size: 300,
  // alwaysVisible: false,
  // xColor: [0, 0, 1, 1],
  // yColor: [1, 0, 1, 1],
  // zColor: [0, 0, 0, 1]
}

// assemble the options for rendering
const renderOptions = {
  camera: state.camera,
  drawCommands: {
    drawAxis: drawCommands.drawAxis,
    drawGrid: drawCommands.drawGrid,
    drawLines: drawCommands.drawLines,
    drawMesh: drawCommands.drawMesh
  },
  // define the visual content
  entities: [
    gridOptions,
    axisOptions
  ]
}

// the heart of rendering, as themes, controls, etc change
let updateView = true

const doRotatePanZoom = () => {

  if (rotateDelta[0] || rotateDelta[1]) {
    const updated = orbitControls.rotate({ controls: state.controls, camera: state.camera, speed: rotateSpeed }, rotateDelta)
    state.controls = { ...state.controls, ...updated.controls }
    updateView = true
    rotateDelta = [0, 0]
  }

  if (panDelta[0] || panDelta[1]) {
    const updated = orbitControls.pan({ controls:state.controls, camera:state.camera, speed: panSpeed }, panDelta)
    state.controls = { ...state.controls, ...updated.controls }
    panDelta = [0, 0]
    state.camera.position = updated.camera.position
    state.camera.target = updated.camera.target
    updateView = true
  }

  if (zoomDelta) {
    const updated = orbitControls.zoom({ controls:state.controls, camera:state.camera, speed: zoomSpeed }, zoomDelta)
    state.controls = { ...state.controls, ...updated.controls }
    zoomDelta = 0
    updateView = true
  }
}

const updateAndRender = (timestamp) => {
  doRotatePanZoom()

  if (updateView) {
    const updates = orbitControls.update({ controls: state.controls, camera: state.camera })
    state.controls = { ...state.controls, ...updates.controls }
    updateView = state.controls.changed // for elasticity in rotate / zoom

    state.camera.position = updates.camera.position
    perspectiveCamera.update(state.camera)

    renderer(renderOptions)
  }
  window.requestAnimationFrame(updateAndRender)
}

window.requestAnimationFrame(updateAndRender)

// convert HTML events (mouse movement) to viewer changes
let lastX = 0
let lastY = 0

const rotateSpeed = 0.002
const panSpeed = 1
const zoomSpeed = 0.08
let rotateDelta = [0, 0]
let panDelta = [0, 0]
let zoomDelta = 0
let pointerDown = false

const moveHandler = (ev) => {
  if(!pointerDown) return
  const dx = lastX - ev.pageX 
  const dy = ev.pageY - lastY 

  const shiftKey = (ev.shiftKey === true) || (ev.touches && ev.touches.length > 2)
  if (shiftKey) {
    panDelta[0] += dx
    panDelta[1] += dy
  } else {
    rotateDelta[0] -= dx
    rotateDelta[1] -= dy
  }

  lastX = ev.pageX
  lastY = ev.pageY

  ev.preventDefault()
}
const downHandler = (ev) => {
  pointerDown = true
  lastX = ev.pageX
  lastY = ev.pageY
  containerElement.setPointerCapture(ev.pointerId)
}

const upHandler = (ev) => {
  pointerDown = false
  containerElement.releasePointerCapture(ev.pointerId)
}

const wheelHandler = (ev) => {
  zoomDelta += ev.deltaY
  ev.preventDefault()
}

containerElement.onpointermove = moveHandler
containerElement.onpointerdown = downHandler
containerElement.onpointerup = upHandler
containerElement.onwheel = wheelHandler

// this updates the entities
// then tells the renderer about it
function create_re_render_fn(regenerate_entities_fn) {
    return (model) => {
        let entities = entitiesFromSolids({}, regenerate_entities_fn(model));
        renderOptions.entities = [
            gridOptions,
            axisOptions,
            ...entities
        ];
        renderer(renderOptions);
    }
}

function re_render(model) {
    let entities = entitiesFromSolids({}, create_entities(model));
    renderOptions.entities = [
      gridOptions,
      axisOptions,
      ...entities
    ];
    renderer(renderOptions);
}

module.exports = {
    create_re_render_fn
}
