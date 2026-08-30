/**
 * Robot Avatar Configuration
 * Centralized configuration for performance tuning and customization
 */

export interface RobotAvatarConfig {
	// Model settings
	modelPath: string;
	dracoDecoderPath: string;

	// Performance settings
	maxPixelRatio: number;
	enableShadows: boolean;
	shadowMapSize: number;
	enableAntialiasing: boolean;

	// Camera settings
	cameraFov: number;
	cameraPosition: { x: number; y: number; z: number };
	cameraTarget: { x: number; y: number; z: number };

	// Lighting settings
	hemisphereIntensity: number;
	directionalIntensity: number;
	fillLightIntensity: number;

	// Animation settings
	defaultAnimation: string;
	talkingAnimation: string;
	fadeInDuration: number;
	fadeOutDuration: number;

	// Speech settings
	wordsPerMinute: number; // For calculating speech duration

	// Render optimization
	enableOnDemandRendering: boolean;
	enableIntersectionObserver: boolean;
	intersectionThreshold: number;
	intersectionRootMargin: string;
}

/**
 * Default Configuration - Optimized for Performance
 */
export const DEFAULT_ROBOT_CONFIG: RobotAvatarConfig = {
	// Model settings
	modelPath: '/assets/models/robot.glb',
	dracoDecoderPath: 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/',

	// Performance settings (prioritize performance)
	maxPixelRatio: 2, // Cap at 2x for performance
	enableShadows: false, // Disabled for better performance
	shadowMapSize: 1024, // Lower resolution if shadows enabled
	enableAntialiasing: true, // Good balance of quality/performance

	// Camera settings
	cameraFov: 45,
	cameraPosition: { x: 0, y: 1.5, z: 3 },
	cameraTarget: { x: 0, y: 1, z: 0 },

	// Lighting settings (balanced)
	hemisphereIntensity: 1.2,
	directionalIntensity: 1.0,
	fillLightIntensity: 0.3,

	// Animation settings
	defaultAnimation: 'idle',
	talkingAnimation: 'talking',
	fadeInDuration: 0.3,
	fadeOutDuration: 0.3,

	// Speech settings
	wordsPerMinute: 150, // Average speaking rate

	// Render optimization
	enableOnDemandRendering: true,
	enableIntersectionObserver: true,
	intersectionThreshold: 0.1,
	intersectionRootMargin: '50px',
};

/**
 * High Quality Configuration - Better visuals, lower performance
 * Use this for hero sections on desktop devices
 */
export const HIGH_QUALITY_ROBOT_CONFIG: RobotAvatarConfig = {
	...DEFAULT_ROBOT_CONFIG,
	maxPixelRatio: 3, // Use device pixel ratio
	enableShadows: true,
	shadowMapSize: 2048,
	hemisphereIntensity: 1.5,
	directionalIntensity: 1.2,
};

/**
 * Performance Configuration - Maximum performance, lower quality
 * Use this for mobile devices or lower-end hardware
 */
export const PERFORMANCE_ROBOT_CONFIG: RobotAvatarConfig = {
	...DEFAULT_ROBOT_CONFIG,
	maxPixelRatio: 1, // Force 1x pixel ratio
	enableShadows: false,
	enableAntialiasing: false, // Disable for max performance
	hemisphereIntensity: 1.0,
	directionalIntensity: 0.8,
	fillLightIntensity: 0.2,
};

/**
 * Mobile Configuration - Optimized for mobile devices
 */
export const MOBILE_ROBOT_CONFIG: RobotAvatarConfig = {
	...PERFORMANCE_ROBOT_CONFIG,
	cameraFov: 50, // Slightly wider FOV for mobile
	intersectionRootMargin: '100px', // Load earlier on mobile
};

/**
 * Animation Names Enum
 * Ensures type-safe animation references
 */
export enum RobotAnimation {
	IDLE = 'idle',
	TALKING = 'talking',
	WAVING = 'waving',
	THINKING = 'thinking',
	EXCITED = 'excited',
	DISAPPOINTED = 'disappointed',
}

/**
 * Helper function to detect device capabilities and select appropriate config
 */
export function getOptimalRobotConfig(): RobotAvatarConfig {
	// Check if mobile
	const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
		navigator.userAgent
	);

	if (isMobile) {
		return MOBILE_ROBOT_CONFIG;
	}

	// Check device memory (if available)
	const deviceMemory = (navigator as any).deviceMemory;
	if (deviceMemory && deviceMemory < 4) {
		return PERFORMANCE_ROBOT_CONFIG;
	}

	// Check hardware concurrency (CPU cores)
	const cores = navigator.hardwareConcurrency || 4;
	if (cores < 4) {
		return PERFORMANCE_ROBOT_CONFIG;
	}

	// Default to balanced config
	return DEFAULT_ROBOT_CONFIG;
}

/**
 * Validation helper
 */
export function validateRobotConfig(config: Partial<RobotAvatarConfig>): RobotAvatarConfig {
	return {
		...DEFAULT_ROBOT_CONFIG,
		...config,
	};
}
