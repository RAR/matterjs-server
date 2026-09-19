/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import {
    attribute,
    bool,
    cluster,
    command,
    event,
    field,
    int16,
    listOf,
    octstr,
    response,
    uint8,
    uint16,
    writable,
} from "@matter/main/model";

// Vendor clusters of the Aqara Spatial Multi-Sensor FP400 (vendor 0x115f / 4447, product 0x2009) in Matter/Thread
// mode. Attribute, command and event names follow the trait names of the Aqara app's device model
// (AmbientSensingConfiguration / RadarSensingUnion / OccupantLocation). Values were verified against firmware 1.1.8.2.
//
// The sensor divides its field of view into a grid of 16 columns x 20 rows of ~50 cm cells. Cell (row, col) maps to
// bit `row * 16 + col` of a 40 byte bitmask, most significant bit first. Row 0 is nearest the sensor, column 8 is
// straight ahead and columns grow as x decreases.
//
// The device only serves these clusters to fabrics it trusts: from a fabric with vendor id 0x134b every read, write and
// command is answered with UnsupportedAttribute, while a fabric with the test vendor id 0xfff1 gets full access
// (wildcard subscriptions deliver the scalar attributes on either).

/**
 * A detection zone. Creating a zone adds a child endpoint with an Occupancy Sensing cluster (and a
 * {@link AqaraRadarSensingUnionCluster} carrying the zone id) below the sensor endpoint.
 */
class AqaraZoneStruct {
    /** 1..8 */
    @field(0x0, uint8)
    zoneId!: number;

    /** Purpose not known; 0 works. */
    @field(0x1, uint8)
    zoneType!: number;

    /** 40 byte cell bitmask, see the grid description above. */
    @field(0x2, octstr)
    cells!: Bytes;

    @field(0x3, bool)
    enabled!: boolean;
}

class AqaraZoneRequest {
    @field(0x0, AqaraZoneStruct)
    zone!: AqaraZoneStruct;
}

class AqaraZoneIdRequest {
    @field(0x0, uint8)
    zoneId!: number;
}

class AqaraZonesRequest {
    @field(0x0, listOf(AqaraZoneStruct))
    zones!: AqaraZoneStruct[];
}

class AqaraTimeoutRequest {
    /** Seconds the device keeps reporting. */
    @field(0x0, uint16)
    timeout!: number;
}

/**
 * Result of a zone command: 0 = success, 1 = invalid argument, 2 = invalid state, 3 = resource exhausted, 4 = busy,
 * 5 = duplicate zone id.
 */
class AqaraZoneResponse {
    @field(0x0, uint8)
    status!: number;
}

@cluster(0x115ffc0a)
export class AqaraAmbientSensingConfigurationCluster {
    /** 0 = unknown, 1 = side (wall) mount, 2 = top (ceiling) mount. */
    @attribute(0x0000, uint8, writable)
    installMode?: number;

    @attribute(0x0001, listOf(uint8))
    supportedInstallModes?: number[];

    /** 0 = unknown, 1 = wall, 2 = left corner, 3 = right corner. */
    @attribute(0x0002, uint8, writable)
    sideInstall?: number;

    @attribute(0x0003, listOf(uint8))
    supportedSideInstalls?: number[];

    /** Mounting height in mm, between installHeightMin and installHeightMax. */
    @attribute(0x0004, uint16, writable)
    installHeight?: number;

    @attribute(0x0005, uint16)
    installHeightMin?: number;

    @attribute(0x0006, uint16)
    installHeightMax?: number;

    /**
     * Orientation measured by the built-in tilt sensor: 0 = level facing up, 1 = level tilted facing up,
     * 2 = level reverse tilted facing up, 3 = side facing forward, 4 = side reverse facing forward,
     * 5 = top facing down, 6 = tilted facing down, 7 = reverse tilted facing down, 8 = invalid.
     */
    @attribute(0x0007, uint8)
    installStatus?: number;

    /** Tilt from horizontal in degrees (unsigned). */
    @attribute(0x0008, uint8)
    installAngle?: number;

    /** Configured zones. Changed through the zone commands, not by writing. */
    @attribute(0x0010, listOf(AqaraZoneStruct))
    zones?: AqaraZoneStruct[];

    @attribute(0x0011, uint8)
    maxZones?: number;

    /** Cells recognised as entry/exit regions (40 byte bitmask). */
    @attribute(0x0012, octstr)
    entryExitRegionBitmask?: Bytes;

    /** Cells recognised as interference sources (40 byte bitmask). */
    @attribute(0x0013, octstr)
    interferenceRegionBitmask?: Bytes;

    /** Cells recognised as room edges (40 byte bitmask). */
    @attribute(0x0014, octstr)
    edgeRegionBitmask?: Bytes;

    /** Seconds; reporting timeout of the AI space background learning. */
    @attribute(0x0016, uint8)
    learningReportingTimeout?: number;

    @attribute(0x0023, bool, writable)
    enableHumanCountDetection?: boolean;

    // The names of attributes 0x27..0x2c are inferred from the Aqara app's cached device model by matching values and
    // have not been confirmed individually.
    @attribute(0x0027, bool, writable)
    enableActivityDetection?: boolean;

    @attribute(0x0029, bool, writable)
    enableAiHighPrecisionRecognition?: boolean;

    @attribute(0x002a, bool, writable)
    enableAiAdaptiveSensitivity?: boolean;

    @attribute(0x002b, bool, writable)
    enableAiEntryExitRegionRecognition?: boolean;

    @attribute(0x002c, bool, writable)
    enableAiInterferenceSourceRecognition?: boolean;

    /** 0 = disabled, 1 = enabled, 2 = auto. */
    @attribute(0x002d, uint8, writable)
    coordinateReverse?: number;

    /** 0 = omnidirectional, 1 = left/right. */
    @attribute(0x002e, uint8, writable)
    detectionDirection?: number;

    /** 0 = far, 1 = medium, 2 = near. */
    @attribute(0x002f, uint8, writable)
    proximityDistanceLevel?: number;

    @command(0x00)
    subscribeAutoInterferenceSourceRecognitionData(): void {}

    @command(0x01, AqaraTimeoutRequest)
    subscribeAutoEdgeRecognitionData(_request: AqaraTimeoutRequest): void {}

    @command(0x02)
    subscribeAiEntryExitRegionRecognitionData(): void {}

    @command(0x03)
    enableAiSpaceBackgroundLearning(): void {}

    /** Adds a zone, or replaces the zone with the same id. */
    @command(0x04, AqaraZoneRequest, response(0x05, AqaraZoneResponse))
    appendZone(_request: AqaraZoneRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }

    @command(0x06, AqaraZoneRequest, response(0x07, AqaraZoneResponse))
    updateZone(_request: AqaraZoneRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }

    @command(0x08, AqaraZoneIdRequest, response(0x09, AqaraZoneResponse))
    removeZone(_request: AqaraZoneIdRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }

    /** Replaces all zones; an empty list removes every zone. */
    @command(0x0a, AqaraZonesRequest, response(0x0b, AqaraZoneResponse))
    setZones(_request: AqaraZonesRequest): AqaraZoneResponse {
        return {} as AqaraZoneResponse;
    }
}

/**
 * Motion event payload: 0 = enter, 1 = left, 2 = left in, 3 = right out, 4 = right in, 5 = left out, 6 = access,
 * 7 = away.
 */
class AqaraMotionDetectedEvent {
    @field(0x0, uint8)
    motion!: number;
}

@cluster(0x115ffc0b)
export class AqaraRadarSensingUnionCluster {
    /** Endpoint ids of the zone child endpoints (present on the sensor endpoint). */
    @attribute(0x0000, listOf(uint16))
    childEndpointList?: number[];

    /** Id of the zone this endpoint represents (present on zone endpoints). */
    @attribute(0x0001, uint8)
    zoneId?: number;

    @attribute(0x0002, uint8)
    currentHumanCount?: number;

    @event(0x00, AqaraMotionDetectedEvent)
    motionDetected!: AqaraMotionDetectedEvent;
}

/** One tracked person. */
class AqaraTargetStruct {
    @field(0x0, uint8)
    targetId!: number;

    /** Sideways position in cm, negative to the left. */
    @field(0x1, int16)
    x!: number;

    /** Distance from the sensor in cm. */
    @field(0x2, int16)
    y!: number;

    /** Grid cell as `row << 8 | column`. */
    @field(0x3, uint16)
    cell!: number;

    /** 1 = active, 2 = still. */
    @field(0x4, uint8)
    activityState!: number;

    @field(0x5, uint8)
    fallState!: number;

    @field(0x6, uint8)
    postureState!: number;

    /** Always observed as 255. */
    @field(0x7, uint8)
    zoneId!: number;

    /** Id of the zone the target is in. Only present while the target is inside a zone. */
    @field(0x8, uint8)
    inZoneId?: number;
}

class AqaraLocationInfoEvent {
    @field(0x0, listOf(AqaraTargetStruct))
    targets!: AqaraTargetStruct[];
}

class AqaraTargetIdRequest {
    @field(0x0, uint8)
    targetId!: number;
}

@cluster(0x115ffc0c)
export class AqaraOccupantLocationCluster {
    @attribute(0x0000, uint8)
    maxDetectionTargets?: number;

    /** 0 = unknown, 1 = active, 2 = still. */
    @attribute(0x0007, uint8)
    activityState?: number;

    /**
     * Streams {@link locationInfo} events (~7 per second while people move) for the given number of seconds
     * (max 3600). Without a subscription the event is only emitted when a target appears or disappears.
     */
    @command(0x00, AqaraTimeoutRequest)
    subscribeLocationData(_request: AqaraTimeoutRequest): void {}

    @command(0x01, AqaraTargetIdRequest)
    removeDetectionTarget(_request: AqaraTargetIdRequest): void {}

    @event(0x00, AqaraLocationInfoEvent)
    locationInfo!: AqaraLocationInfoEvent;
}
