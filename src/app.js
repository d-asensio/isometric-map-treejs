import {
  BoxBufferGeometry,
  CubeGeometry,
  Mesh,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
  DirectionalLight,
  MeshStandardMaterial,
  Vector2,
  Raycaster,
  AnimationMixer,
  Clock,
  Euler,
  LineBasicMaterial,
  Vector3,
  BufferGeometry,
  Line
} from 'three'

import Stats from 'three/examples/jsm/libs/stats.module'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'

import { createGuiFromPropertiesObject } from './helpers'
import { RouteTracer } from './route-tracer'
import { GridRouteFinder } from './route-finder'

export const App = (function () {
  const _BLOCK_SIZE = 20
  const _TILE_THICKNESS = 2
  const _CURSOR_THICKNESS = 1
  const _FLOOR_BLOCKS_SIZE = 10

  const _COLOR_TILES = 0xa0382c
  const _COLOR_LIGHT = 0xffffff
  const _COLOR_INTERSECTION_CURSOR = 0xe6c34f

  const _CHARACTER_MODEL_URL = 'assets/models/michelle.fbx'

  const _SCENE_MIN_ZOOM = 5
  const _SCENE_MAX_ZOOM = 50

  let _rootDOMElement = null
  const _stats = new Stats()

  let _size = null

  let _camera = null
  let _renderer = null
  let _scene = null

  let _light = null

  let _character = null
  let _characterAnimationMixer = null
  let _characterRouteTrace = null

  const _characterAnimations = {}
  let _characterActiveAnimation = null
  let _characterActiveAnimationName = null

  let _characterPosition = new Vector3(0, 0, 0)
  let _characterRotation = 0

  let _characterRoute = []

  const _clock = new Clock()
  const _mouse = new Vector2()
  const _raycaster = new Raycaster()
  const _loader = new FBXLoader()

  const _routeFinder = new GridRouteFinder(
    _FLOOR_BLOCKS_SIZE,
    _FLOOR_BLOCKS_SIZE
  )

  const _routeTracer = new RouteTracer()

  const _objects = []

  let _intersectionCursor = null

  let _zoom = 10

  const _sceneProperties = {
    camera: {
      position: {
        type: 'coordinates',
        range: [-1000, 1000],
        step: 1,
        value: { x: -200, y: 200, z: -200 },
        updateFn: _updateCameraPosition
      },
      target: {
        type: 'coordinates',
        range: [-1000, 1000],
        step: 1,
        value: { x: 0, y: 0, z: 0 },
        updateFn: _updateCameraTarget
      }
    },
    light: {
      intensity: {
        type: 'value',
        range: [0, 50],
        step: 0.1,
        value: 2,
        updateFn: _updateLightIntensity
      },
      position: {
        type: 'coordinates',
        range: [-1000, 1000],
        step: 1,
        value: { x: -150, y: 120, z: -50 },
        updateFn: _updateLightPosition
      },
      target: {
        type: 'coordinates',
        range: [-1000, 1000],
        step: 1,
        value: { x: 0, y: 0, z: 0 },
        updateFn: _updateLightPosition
      }
    }
  }

  async function init (config) {
    const { rootDOMElement } = config

    _rootDOMElement = rootDOMElement

    _syncSceneWithScreenSize()

    _initGui()

    _initCamera()
    _initRenderer()
    _initScene()

    await Promise.all([
      _loadCharacter(),
      _loadCharacterAnimation('walking'),
      _loadCharacterAnimation('idle')
    ])

    _initCharacterAnimation()

    _mountSceneToDOM()
    _mountStatsToDOM()

    _initialRender()
    _initRenderLoop()

    window.addEventListener('resize', _handleWindowResize, false)

    _rootDOMElement.addEventListener('mousemove', _handleMouseMove, false)
    _rootDOMElement.addEventListener('mousedown', _handleMouseDown, false)
    _rootDOMElement.addEventListener('keydown', _handleKeyDown, false)
    _rootDOMElement.addEventListener('wheel', _handleWheel, false)
  }

  function _syncSceneWithScreenSize () {
    const { innerWidth, innerHeight } = window

    _size = {
      width: innerWidth,
      height: innerHeight
    }
  }

  function _initGui () {
    createGuiFromPropertiesObject(_sceneProperties)
  }

  function _initCamera () {
    _camera = new OrthographicCamera()

    _updateCameraFrustrum()
    _updateCameraPosition()
    _updateCameraZoom()

    _updateCameraTarget()
  }

  function _updateCameraTarget () {
    const { x, y, z } = _sceneProperties.camera.target.value
    _camera.lookAt(x, y, z)
  }

  function _initRenderer () {
    _renderer = new WebGLRenderer({
      antialias: true
    })

    /**
     * This is set to 1 for maximum performance while developing.
     *
     * TODO:
     * Set this to 'window.devicePixelRatio' to adjusti it to the real device
     * resolution.
     */
    _renderer.setPixelRatio(1)

    _updateRendererSize()
  }

  function _updateRendererSize () {
    _renderer.setSize(
      _size.width,
      _size.height
    )
  }

  function _initScene () {
    _scene = new Scene()
  }

  function _initRenderLoop () {
    requestAnimationFrame(_initRenderLoop)

    // Next character frame
    const delta = _clock.getDelta()

    if (_characterAnimationMixer) {
      _characterAnimationMixer.update(delta)
    }

    _routeTracer.update(delta)

    if (_routeTracer.isPlaying()) {
      const characterPosition = _routeTracer.getPosition()

      _setCharacterPosition(characterPosition)

      _updateCharacterPosition()
    } else {
      _playCharacterAnimation('idle')
    }

    _renderer.render(_scene, _camera)
    _stats.update()
  }

  function _mountSceneToDOM () {
    _rootDOMElement.appendChild(_renderer.domElement)
  }

  function _mountStatsToDOM () {
    _rootDOMElement.appendChild(_stats.dom)
  }

  function _addTilePlane () {
    for (let x = 0; x <= _FLOOR_BLOCKS_SIZE; x++) {
      for (let z = 0; z <= _FLOOR_BLOCKS_SIZE; z++) {
        _addTile({
          x: x * _BLOCK_SIZE,
          y: 0,
          z: z * _BLOCK_SIZE
        })
      }
    }
  }

  async function _loadCharacter () {
    _character = await _loadFBXObject(_CHARACTER_MODEL_URL)
  }

  async function _loadCharacterAnimation (animationName) {
    const fbxObject = await _loadFBXObject(`assets/animations/${animationName}.fbx`)

    const [animation] = fbxObject.animations

    _characterAnimations[animationName] = animation
  }

  function _initCharacterAnimation () {
    _characterAnimationMixer = new AnimationMixer(_character)

    _playCharacterAnimation('idle')
  }

  function _playCharacterAnimation (animationName) {
    if (animationName === _characterActiveAnimationName) return

    if (_characterActiveAnimation !== null) {
      _characterActiveAnimation.fadeOut(0.5)
    }

    const animation = _characterAnimations[animationName]

    _characterActiveAnimation = _characterAnimationMixer.clipAction(
      animation
    )

    _characterActiveAnimationName = animationName
    _characterActiveAnimation.reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .fadeIn(0.5)
      .play()
  }

  async function _loadFBXObject (url) {
    return new Promise((resolve, reject) => {
      _loader.load(url, resolve)
    })
  }

  function _initialRender () {
    _addTilePlane()
    _addCharacterRouteTrace()
    _addCharacter()
    _addLight()
  }

  function _updateOrAddIntersectionCursor (cursorPosition) {
    if (_intersectionCursor === null) {
      _addIntersectionCursor()
    }

    _updateIntersectionCursorPosition(cursorPosition)
  }

  function _updateIntersectionCursorPosition ({ x, y, z }) {
    _intersectionCursor.position.set(x, y, z)
  }

  function _addIntersectionCursor () {
    const geometry = new BoxBufferGeometry(
      _BLOCK_SIZE,
      _CURSOR_THICKNESS,
      _BLOCK_SIZE
    )

    const material = new MeshStandardMaterial({
      color: _COLOR_INTERSECTION_CURSOR
    })

    _intersectionCursor = new Mesh(geometry, material)

    _scene.add(_intersectionCursor)
  }

  function _removeIntersectionCursor () {
    _scene.remove(_intersectionCursor)
    _intersectionCursor = null
  }

  function _addTile ({ x, y, z }) {
    const geometry = new BoxBufferGeometry(
      _BLOCK_SIZE,
      _TILE_THICKNESS,
      _BLOCK_SIZE
    )

    const material = new MeshStandardMaterial({
      color: _COLOR_TILES
    })

    const mesh = new Mesh(geometry, material)

    mesh.position.set(x, y, z)
    _addObjectToScene(mesh)
  }

  function _getRandomColor () {
    const { random } = Math

    return (0xFFFFFF * random())
  }

  function _addBlockToCursorPosition () {
    const geometry = new CubeGeometry(
      _BLOCK_SIZE,
      _BLOCK_SIZE,
      _BLOCK_SIZE
    )

    const material = new MeshStandardMaterial({
      color: _getRandomColor()
    })

    const block = new Mesh(geometry, material)

    block.position.copy(_intersectionCursor.position)
    block.position.y = _intersectionCursor.position.y + (_BLOCK_SIZE / 2) - (_CURSOR_THICKNESS / 2)

    _addObjectToScene(block)
  }

  function _createRouteToCursorPosition () {
    const { round } = Math
    const { x: characterX, z: characterZ } = _characterPosition
    const { x: cursorX, z: cursorZ } = _intersectionCursor.position

    const optimalRoute = _routeFinder.find(
      [round(characterX / _BLOCK_SIZE), round(characterZ / _BLOCK_SIZE)], // Rounded and divided by the _BLOCK_SIZE since the route finder is discrete
      [cursorX / _BLOCK_SIZE, cursorZ / _BLOCK_SIZE]
    )

    _characterRoute = optimalRoute.map(
      ([x, y]) => [x * _BLOCK_SIZE, _TILE_THICKNESS, y * _BLOCK_SIZE]
    )

    _updateCharacterRouteTrace()
    _routeTracer.setRoute(_characterRoute)
    _playCharacterAnimation('walking')
  }

  function _addCharacter () {
    // Scale character to be in accordance with the block size
    // TODO: Automate this taking into account the block size and the character bbox
    _character.scale.set(0.25, 0.25, 0.25)

    _updateCharacterPosition()

    _scene.add(_character)
  }

  function _addLight () {
    _light = new DirectionalLight(_COLOR_LIGHT, 5)

    _updateLightPosition()
    _updateLightIntensity()

    _scene.add(_light)
    _scene.add(_light.target)
  }

  function _addObjectToScene (object) {
    _scene.add(object)
    _objects.push(object)
  }

  function _addCharacterRouteTrace () {
    const material = new LineBasicMaterial({
      color: 0x0000ff
    })

    const geometry = new BufferGeometry()

    _characterRouteTrace = new Line(geometry, material)

    _updateCharacterRouteTrace()

    _scene.add(_characterRouteTrace)
  }

  function _updateCharacterRouteTrace () {
    const routePoints = _characterRoute.map(
      ([x, y, z]) => new Vector3(x, y, z)
    )

    _characterRouteTrace.geometry.setFromPoints(routePoints)
  }

  function _updateCameraFrustrum () {
    const { width, height } = _size

    _camera.left = -width
    _camera.right = width
    _camera.top = height
    _camera.bottom = -height
    _camera.near = 0
    _camera.far = 1000

    _camera.updateProjectionMatrix()
  }

  function _updateCameraPosition () {
    const { x, y, z } = _sceneProperties.camera.position.value
    _camera.position.set(x, y, z)
  }

  function _updateCameraZoom () {
    _camera.zoom = _zoom
    _camera.updateProjectionMatrix()
  }

  function _updateLightIntensity () {
    const { intensity } = _sceneProperties.light
    _light.intensity = intensity.value
  }

  function _updateLightPosition () {
    const { position, target } = _sceneProperties.light
    _light.position.set(
      position.value.x,
      position.value.y,
      position.value.z
    )

    _light.target.position.set(
      target.value.x,
      target.value.y,
      target.value.z
    )
  }

  function _updateCharacterPosition () {
    const { x, y, z } = _characterPosition
    _character.position.set(
      x,
      y + (_TILE_THICKNESS / 2),
      z
    )

    _updateCharacterDirection()
    _setCameraLookToCharacter()
  }

  function _updateCharacterDirection () {
    const rotationEuler = new Euler(0, _characterRotation, 0)

    _character.setRotationFromEuler(rotationEuler)
  }

  function _setCameraLookToCharacter () {
    const {
      x,
      y,
      z
    } = _sceneProperties.camera.position.value

    const {
      x: cx,
      y: cy,
      z: cz
    } = _characterPosition

    _camera.position.set(
      x + cx,
      y + cy + _BLOCK_SIZE, // Assumes that the character ia 2 block tall
      z + cz
    )
  }

  function _setCharacterPosition (position) {
    _characterRotation = _getCharacterRotationToPositon(position)
    _characterPosition = position
  }

  function _getCharacterRotationToPositon (position) {
    const { PI } = Math

    const { x: x0, z: z0 } = position
    const { x: x1, z: z1 } = _characterPosition

    if (x0 > x1 && z0 > z1) return PI / 4
    if (x0 < x1 && z0 < z1) return -PI + PI / 4
    if (x0 > x1 && z0 < z1) return PI - PI / 4
    if (x0 < x1 && z0 > z1) return -PI / 4

    if (x0 > x1) return PI / 2
    if (x0 < x1) return -PI / 2
    if (z0 > z1) return 0
    if (z0 < z1) return -PI
  }

  function _handleWindowResize () {
    _syncSceneWithScreenSize()

    _updateCameraFrustrum()
    _updateRendererSize()
  }

  function _handleMouseMove (event) {
    const { clientX, clientY } = event
    const { width, height } = _size

    _mouse.set(
      (clientX / width) * 2 - 1, // This is the ratio [-1, 1]
      -(clientY / height) * 2 + 1
    )

    _raycaster.setFromCamera(_mouse, _camera)
    const intersections = _raycaster.intersectObjects(_objects)

    const [nearestIntersection] = intersections

    if (nearestIntersection) {
      const { position, geometry } = nearestIntersection.object

      geometry.computeBoundingBox()
      const bbox = geometry.boundingBox

      const cursorPosition = {
        ...position,
        y: position.y + bbox.max.y + (_CURSOR_THICKNESS / 2)
      }

      _updateOrAddIntersectionCursor(cursorPosition)
    } else {
      _removeIntersectionCursor()
    }
  }

  function _handleMouseDown () {
    if (_intersectionCursor !== null) {
      _createRouteToCursorPosition()
      _addBlockToCursorPosition()
    }
  }

  function _handleKeyDown (event) {
    switch (event.code) {
      case 'ArrowUp':
        _characterPosition.x += _BLOCK_SIZE
        _characterPosition.z += _BLOCK_SIZE
        break
      case 'ArrowDown':
        _characterPosition.x -= _BLOCK_SIZE
        _characterPosition.z -= _BLOCK_SIZE
        break
      case 'ArrowRight':
        _characterPosition.x -= _BLOCK_SIZE
        _characterPosition.z += _BLOCK_SIZE
        break
      case 'ArrowLeft':
        _characterPosition.x += _BLOCK_SIZE
        _characterPosition.z -= _BLOCK_SIZE
        break
    }

    _updateCharacterPosition()
  }

  function _handleWheel (e) {
    const { min, max } = Math
    const { deltaY } = e

    const zoomIncrement = -deltaY / 10

    const newZoom = _zoom += zoomIncrement

    _zoom = max(_SCENE_MIN_ZOOM,
      min(_SCENE_MAX_ZOOM,
        newZoom
      )
    )

    _updateCameraZoom()
  }

  return {
    init
  }
})()
