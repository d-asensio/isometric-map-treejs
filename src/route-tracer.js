import { Line3, Vector3 } from 'three'

// Very inefficient and unreliable route tracer :)
export class RouteTracer {
  constructor () {
    this._routeSegments = []
    this._totalDistance = 0

    this._velocity = 30 // Units per seond
    this._elapsedTimeInSeconds = 0
  }

  setRoute (routeDefinition) {
    const [startPoint, ...restOfPoints] = routeDefinition

    let previousPoint = startPoint

    this._routeSegments = []

    for (const currentPoint of restOfPoints) {
      const startVector = new Vector3(...previousPoint)
      const endVector = new Vector3(...currentPoint)

      const segment = new Line3(startVector, endVector)
      this._totalDistance += segment.distance()

      this._routeSegments.push(segment)

      previousPoint = currentPoint
    }

    this.reset()
  }

  // This method returns position and direction for convenience, refactor this when its time to implement "real code"
  getPositionAndDirection () {
    const currentSegmentIndex = this._getCurrentSegmentIndex()
    const currentSegment = this._routeSegments[currentSegmentIndex]

    const distanceToSegment = this._getDistanceToSegment(currentSegmentIndex)
    const distanceFromSegmentStart = this._getTravelledDistance() - distanceToSegment

    const positionPercentageInSegment = distanceFromSegmentStart / currentSegment.distance()

    const position = currentSegment.at(positionPercentageInSegment, new Vector3())
    const direction = this._getSegmentDirection(currentSegment)

    return [position, direction]
  }

  _getSegmentDirection (segment) {
    if (segment.start.z < segment.end.z) return 'up'
    if (segment.start.z > segment.end.z) return 'down'
    if (segment.start.x < segment.end.x) return 'left'
    if (segment.start.x > segment.end.x) return 'right'
  }

  _getCurrentSegmentIndex () {
    const travelledDistance = this._getTravelledDistance()

    let accumulatedDistance = 0

    for (const segmentIndex in this._routeSegments) {
      accumulatedDistance += this._routeSegments[segmentIndex].distance()

      if (accumulatedDistance > travelledDistance) {
        return segmentIndex
      }
    }
  }

  _getDistanceToSegment (segmentIndex) {
    let accumulatedDistance = 0

    for (let i = 0; i < segmentIndex; i++) {
      accumulatedDistance += this._routeSegments[i].distance()
    }

    return accumulatedDistance
  }

  _getTravelledDistance () {
    return this._velocity * this._elapsedTimeInSeconds
  }

  update (secondsDelta) {
    this._elapsedTimeInSeconds += secondsDelta
  }

  finished () {
    return this._getTravelledDistance() >= this._totalDistance
  }

  reset () {
    this._elapsedTimeInSeconds = 0
  }
}
