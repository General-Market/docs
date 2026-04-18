/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setNumberOfSharedAudioTags(40);

// WebGL 3D rendering: limit to 1 concurrent tab to avoid
// "WebGL context lost" errors from too many GPU contexts.
Config.setConcurrency(1);

// Use ANGLE backend for stable WebGL rendering.
Config.setChromiumOpenGlRenderer("angle");
