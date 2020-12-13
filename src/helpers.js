
import { GUI } from 'dat.gui'

export function createGuiFromPropertiesObject (propertyGroupsObject) {
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

    folder
      .add(propertyDefinition, 'value', ...range, step)
      .onChange(updateFn)
  }

  const propertyGroupsEntries = Object.entries(propertyGroupsObject)

  for (const [groupName, groupProperties] of propertyGroupsEntries) {
    const propertiesEntries = Object.entries(groupProperties)
    const groupFolder = gui.addFolder(groupName)

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
