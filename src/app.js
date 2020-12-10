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
  Raycaster
} from 'three'

import Stats from 'three/examples/jsm/libs/stats.module.js'

import { GUI } from 'dat.gui'

function createGuiFromPropertiesObject (propertyGroupsObject) {
  const gui = new GUI()

  function createCoordinatesType (gui, propertyName, propertyDefinition) {
    const { value, range, step, updateFn } = propertyDefinition
    const folder = gui.addFolder(propertyName)

    folder.open()

    folder
      .add(value, 'x', ...range, step)
      .onChange(updateFn)

    folder
      .add(value, 'y', ...range, step)
      .onChange(updateFn)

    folder
      .add(value, 'z', ...range, step)
      .onChange(updateFn)
  }

  function createValueType (gui, propertyName, propertyDefinition) {
    const { range, step, updateFn } = propertyDefinition
    const folder = gui.addFolder(propertyName)

    folder.open()

    folder
      .add(propertyDefinition, 'value', ...range, step)
      .onChange(updateFn)
  }

  const propertyGroupsEntries = Object.entries(propertyGroupsObject)

  for (const [groupName, groupProperties] of propertyGroupsEntries) {
    const propertiesEntries = Object.entries(groupProperties)
    const groupFolder = gui.addFolder(groupName)

    groupFolder.open()

    for (const [propertyName, propertyDefinition] of propertiesEntries) {
      switch (propertyDefinition.type) {
        case 'coordinates':
          createCoordinatesType(groupFolder, propertyName, propertyDefinition)
          break
        default:
          createValueType(groupFolder, propertyName, propertyDefinition)
      }
    }
  }

  return gui
}

export const App = (function () {
  const _BLOCK_SIZE = 20
  const _TILE_THICKNESS = 2
  const _CURSOR_THICKNESS = 1
  const _FLOOR_BLOCKS_SIZE = 10

  const _COLOR_CHARACTER = 0x08b19a
  const _COLOR_TILES = 0xa0382c
  const _COLOR_LIGHT = 0xffffff
  const _COLOR_INTERSECTION_CURSOR = 0xe6c34f

  let _rootDOMElement = null
  let _stats = null

  let _size = null

  let _camera = null
  let _renderer = null
  let _scene = null

  let _light = null

  let _character = null

  const _mouse = new Vector2()
  const _raycaster = new Raycaster()

  const _objects = []

  let _intersectionCursor = null

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
      },
      zoom: {
        type: 'value',
        range: [10, 100],
        step: 0.01,
        value: 10,
        updateFn: _updateCameraZoom
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
    },
    character: {
      position: {
        type: 'coordinates',
        range: [0, _FLOOR_BLOCKS_SIZE * _BLOCK_SIZE],
        step: _BLOCK_SIZE,
        value: { x: 0, y: 0, z: 0 },
        updateFn: _updateCharacterPosition
      }
    }
  }

  function init (config) {
    const { rootDOMElement } = config

    _rootDOMElement = rootDOMElement

    _syncSceneWithScreenSize()

    _initGui()
    _initStats()

    _initCamera()
    _initRenderer()
    _initScene()

    _mountSceneToDOM()
    _mountStatsToDOM()

    _initialRender()
    _initRenderLoop()

    document.addEventListener('mousemove', _handleMouseMove, false)
    document.addEventListener('mousedown', _handleMouseDown, false)

    window.addEventListener('resize', _handleWindowResize, false)
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

  function _initStats () {
    _stats = new Stats()
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
    _renderer.render(_scene, _camera)
    _stats.update()
  }

  function _mountSceneToDOM () {
    _rootDOMElement.appendChild(_renderer.domElement)
  }

  function _mountStatsToDOM () {
    _rootDOMElement.appendChild(_stats.dom)
  }

  function _initialRender () {
    for (let x = 0; x <= _FLOOR_BLOCKS_SIZE; x++) {
      for (let z = 0; z <= _FLOOR_BLOCKS_SIZE; z++) {
        _addTile({
          x: x * _BLOCK_SIZE,
          y: 0,
          z: z * _BLOCK_SIZE
        })
      }
    }

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
    block.position.y = _intersectionCursor.position.y + (_TILE_THICKNESS / 2) + (_BLOCK_SIZE / 2) - _CURSOR_THICKNESS

    _addObjectToScene(block)
  }

  function _addCharacter () {
    const geometry = new CubeGeometry(
      _BLOCK_SIZE,
      _BLOCK_SIZE,
      _BLOCK_SIZE
    )
    const material = new MeshStandardMaterial({
      color: _COLOR_CHARACTER
    })

    _character = new Mesh(geometry, material)

    _updateCharacterPosition()

    _addObjectToScene(_character)
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
    const { value } = _sceneProperties.camera.zoom
    _camera.zoom = value
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
    const { x, y, z } = _sceneProperties.character.position.value
    _character.position.set(
      x,
      y + (_TILE_THICKNESS / 2) + (_BLOCK_SIZE / 2),
      z
    )
    _setCameraLookToCharacter()
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
    } = _sceneProperties.character.position.value

    _camera.position.set(
      x + cx,
      y + cy,
      z + cz
    )
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
      (clientX / width) * 2 - 1, // This is teh ratio [-1, 1]
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
        y: position.y + bbox.max.y
      }

      _updateOrAddIntersectionCursor(cursorPosition)
    } else {
      _removeIntersectionCursor()
    }
  }

  function _handleMouseDown () {
    console.log('Hola')
    if (_intersectionCursor !== null) {
      _addBlockToCursorPosition()
    }
  }

  return {
    init
  }
})()
