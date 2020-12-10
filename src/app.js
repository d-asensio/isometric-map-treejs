import {
  BoxBufferGeometry,
  CubeGeometry,
  Mesh,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
  DirectionalLight,
  MeshStandardMaterial
} from 'three'

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
  const _BLOCK_SIZE = 50
  const _TILE_THICKNESS = 5
  const _FLOOR_BLOCKS_SIZE = 5

  const _COLOR_CHARACTER = 0x08b19a
  const _COLOR_TILES = 0xa0382c
  const _COLOR_LIGHT = 0xffffff

  let _rootDOMElement = null

  let _size = null

  let _camera = null
  let _renderer = null
  let _scene = null

  let _light = null

  let _character = null

  const _sceneProperties = {
    camera: {
      position: {
        type: 'coordinates',
        range: [-1000, 1000],
        step: 1,
        value: { x: -150, y: 280, z: 400 },
        updateFn: _updateCameraPosition
      },
      zoom: {
        type: 'value',
        range: [0, 10],
        step: 0.01,
        value: 7,
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
        value: { x: -150, y: 280, z: 400 },
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

    _initCamera()
    _initRenderer()
    _initScene()

    _mountSceneToDOM()

    _initialRender()
    _initRenderLoop()

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

  function _initCamera () {
    _camera = new OrthographicCamera()

    _updateCameraFrustrum()
    _updateCameraPosition()
    _updateCameraZoom()

    _setCameraIsometricPerspective()
  }

  function _setCameraIsometricPerspective () {
    const { atan, sqrt, PI } = Math

    _camera.rotation.order = 'YXZ'
    _camera.rotation.y = -PI / 4
    _camera.rotation.x = atan(-1 / sqrt(2))
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
  }

  function _mountSceneToDOM () {
    _rootDOMElement.appendChild(_renderer.domElement)
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
    _scene.add(mesh)
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

    _scene.add(_character)
  }

  function _addLight () {
    _light = new DirectionalLight(_COLOR_LIGHT, 5)

    _updateLightPosition()

    _scene.add(_light)
    _scene.add(_light.target)
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
  }

  function _handleWindowResize () {
    _syncSceneWithScreenSize()

    _updateCameraFrustrum()
    _updateRendererSize()
  }

  return {
    init
  }
})()
