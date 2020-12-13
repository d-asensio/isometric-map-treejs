import { Line3, Vector3 } from 'three'

class Path3 {
  constructor (segments) {
    this._segments = segments

    this._segmentsByStartDistance = new Map()
    this._totalSegmentDistance = 0

    this._buildSegmentsIndex()
  }

  distance () {
    return this._totalSegmentDistance
  }

  at (delta) {
    const distanceToDelta = this._getDistanceToDelta(delta)
    const segmentStartDistance = this._getSegmentStartDistanceAt(distanceToDelta)

    const segment = this._segmentsByStartDistance.get(segmentStartDistance)

    const distanceAtSegment = (distanceToDelta - segmentStartDistance)
    const segmentDelta = distanceAtSegment / segment.distance()

    return segment.at(
      segmentDelta,
      new Vector3() // For some reason THREE.Line3 throws a warning if this is not defined.
    )
  }

  _buildSegmentsIndex () {
    let accumulatedDistance = 0

    for (const segment of this._segments) {
      this._segmentsByStartDistance.set(
        accumulatedDistance,
        segment
      )

      accumulatedDistance += segment.distance()
    }

    this._totalSegmentDistance = accumulatedDistance
  }

  _getDistanceToDelta (delta) {
    return delta * this._totalSegmentDistance
  }

  _getSegmentStartDistanceAt (distance) {
    const segmentDistances = Array.from(this._segmentsByStartDistance.keys())
    for (const distanceToSegment of segmentDistances.reverse()) {
      if (distance > distanceToSegment) {
        return distanceToSegment
      }
    }
  }
}

export class RouteTracer {
  constructor () {
    this._routePath = null

    this._velocity = 35
    this._elapsedTimeInSeconds = 0
  }

  setRoute (routeDefinition) {
    this.reset()

    const [startPoint, ...restOfPoints] = routeDefinition

    let previousPoint = startPoint

    const pathSegments = []

    for (const currentPoint of restOfPoints) {
      const startVector = new Vector3(...previousPoint)
      const endVector = new Vector3(...currentPoint)

      const segment = new Line3(startVector, endVector)

      pathSegments.push(segment)

      previousPoint = currentPoint
    }

    this._routePath = new Path3(pathSegments)
  }

  update (secondsDelta) {
    this._elapsedTimeInSeconds += secondsDelta
  }

  isPlaying () {
    if (this._routePath === null) return false

    return this._getPositionDelta() < 1
  }

  reset () {
    this._elapsedTimeInSeconds = 0
  }

  getPosition () {
    const positionDelta = this._getPositionDelta()

    return this._routePath.at(positionDelta)
  }

  _getPositionDelta () {
    const totalDistance = this._routePath.distance()
    const travelledDistance = this._getTravelledDistance()

    return travelledDistance / totalDistance
  }

  _getTravelledDistance () {
    return this._velocity * this._elapsedTimeInSeconds
  }
}
