class Spot {
  constructor (x, y) {
    this._x = x
    this._y = y

    this._gScore = Infinity
    this._hScore = 0

    this._parentSpot = null
  }

  get x () { return this._x }
  get y () { return this._y }

  get gScore () { return this._gScore }
  set gScore (score) { this._gScore = score }

  get hScore () { return this._hScore }
  set hScore (score) { this._hScore = score }

  get fScore () { return this._gScore + this._hScore }

  get parent () { return this._parentSpot }
  set parent (spot) { this._parentSpot = spot }

  euclidianDistanceTo (spot) {
    const { abs, sqrt, pow } = Math

    const legX = abs(this._x - spot.x)
    const legY = abs(this._y - spot.y)

    return sqrt(
      pow(legX, 2) +
      pow(legY, 2)
    )
  }

  equals (spot) {
    return this.euclidianDistanceTo(spot) === 0
  }
}

class SpotSet {
  constructor () {
    this._spots = []
  }

  // This can be optimized by using min-heap :)
  getPreferredCandidate () {
    let lowestScoreSpot = null

    for (const spot of this._spots) {
      if (
        lowestScoreSpot === null ||
        spot.fScore < lowestScoreSpot.fScore
      ) {
        lowestScoreSpot = spot
      }
    }

    return lowestScoreSpot
  }

  includes (searchSpot) {
    const foundSpot = this._spots.find(
      iterateeSpot => iterateeSpot.equals(searchSpot)
    )

    return Boolean(foundSpot)
  }

  getByCoordinates ([x, y]) {
    const searchSpot = new Spot(x, y)
    const foundSpot = this._spots.find(
      iterateeSpot => iterateeSpot.equals(searchSpot)
    )

    if (!foundSpot) {
      return searchSpot
    }

    return foundSpot
  }

  add (spot) {
    this._spots.push(spot)
  }

  remove (spot) {
    this._spots = this._spots.filter(
      iterateeSpot => !spot.equals(iterateeSpot)
    )
  }

  empty () {
    return this._spots.length === 0
  }
}

export class GridRouteFinder {
  constructor (mapWidth, mapHeight) {
    this._mapWidth = mapWidth
    this._mapHeight = mapHeight
  }

  _reconstructRoute (spot) {
    const route = []
    let current = spot

    while (current !== null) {
      route.unshift([
        current.x,
        current.y
      ])
      current = current.parent
    }

    return route
  }

  _heuristic (candidate, end) {
    return candidate.euclidianDistanceTo(end)
  }

  _addOptimalNeighbor (openSet, spot, endSpot) {
    for (let xOffset = -1; xOffset <= 1; xOffset++) {
      for (let yOffset = -1; yOffset <= 1; yOffset++) {
        if (xOffset === 0 && yOffset === 0) continue // Same node

        const neighborX = spot.x + xOffset
        const neighborY = spot.y + yOffset

        if (neighborX > this._mapWidth || neighborX < 0) continue // Outside map widht
        if (neighborY > this._mapHeight || neighborY < 0) continue // Outside map height

        const neighbor = openSet.getByCoordinates([neighborX, neighborY])

        const tentativeGScore = spot.gScore + (spot.gScore + 1)

        if (tentativeGScore < neighbor.gScore) {
          neighbor.parent = spot
          neighbor.gScore = tentativeGScore
          neighbor.hScore = this._heuristic(neighbor, endSpot)

          if (!openSet.includes(neighbor)) {
            openSet.add(neighbor)
          }
        }
      }
    }
  }

  find (start, end) {
    const startSpot = new Spot(...start)
    const endSpot = new Spot(...end)

    const openSet = new SpotSet()
    openSet.add(startSpot)

    startSpot.gScore = 0
    startSpot.hScore = this._heuristic(startSpot, endSpot)

    while (!openSet.empty()) {
      const current = openSet.getPreferredCandidate()

      if (current.equals(endSpot)) {
        return this._reconstructRoute(current) // Todo reconstruct the path
      }

      openSet.remove(current)

      this._addOptimalNeighbor(openSet, current, endSpot)
    }

    throw new Error('No possible route')
  }
}
