import {
	Component,
	ElementRef,
	ViewChild,
	AfterViewInit,
	OnDestroy,
	NgZone,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	signal,
	Inject,
	PLATFORM_ID,
	inject,
	effect
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import gsap from 'gsap';
import { AuthStore } from '../../core/store/auth.store';
import { environment } from '../../../environments/environment';

/**
 * Living Full-Screen 3D Robot Avatar
 *
 * A production-ready flying robot assistant with:
 * - Full-screen transparent overlay (click-through enabled)
 * - GSAP-powered smooth movements
 * - SpeechSynthesis API integration
 * - Automatic animation crossfading
 * - Performance-optimized with zone management
 */

interface Position3D {
	x: number;
	y: number;
	z: number;
	rotY?: number;
}

const POSITIONS: Record<string, Position3D> = {
	HIDDEN: { x: 0, y: -10, z: 0, rotY: 0 },
	CENTER: { x: 0, y: -1.5, z: 0, rotY: 0 },
	ASSISTANT: { x: 1.5, y: -2.2, z: 0, rotY: -0.5 },
};

@Component({
	selector: 'app-robot-avatar',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './robot-avatar.html',
	styleUrl: './robot-avatar.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'fixed inset-0 z-[9999] pointer-events-none',
	},
})
export class RobotAvatar implements AfterViewInit, OnDestroy {
	@ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

	// Reactive state
	isLoading = signal(true);
	isReady = signal(false);
	isSpeaking = signal(false);
	loadError = signal<string | null>(null);
	hasStarted = signal(false);

	// Three.js core
	private scene!: THREE.Scene;
	private camera!: THREE.PerspectiveCamera;
	private renderer!: THREE.WebGLRenderer;
	private clock: THREE.Clock = new THREE.Clock();

	// Model
	private robotModel!: THREE.Group;

	// Backend Motion Streamer Receptor
	private bones: { [key: string]: THREE.Bone } = {};
	private motionQueue: any[] = [];

	// Locomotion state
	private isWalking = false;

	// Performance
	private animationFrameId?: number;
	private activeTweens: gsap.core.Tween[] = [];

	// Speech Synthesis (for fallback)
	private synth?: any;
	private currentUtterance?: SpeechSynthesisUtterance;
	private currentAudio?: HTMLAudioElement; // For backend TTS audio playback

	private isBrowser: boolean;
	private authStore = inject(AuthStore);
	private router = inject(Router);
	private socket!: Socket;
	private hasGreetedOwner = false;

	constructor(
		private ngZone: NgZone,
		private cdr: ChangeDetectorRef,
		@Inject(PLATFORM_ID) private platformId: Object
	) {
		this.isBrowser = isPlatformBrowser(this.platformId);
		if (this.isBrowser) {
			this.synth = window.speechSynthesis;
		}
		THREE.Cache.enabled = true;

		// 2. THE "OWNER DETECTED" EXCITEMENT STATE
		effect(() => {
			const user = this.authStore.currentUser();
			const ready = this.isReady();
			if (ready && user && user.firstName && !this.hasGreetedOwner) {
				this.hasGreetedOwner = true;
				// Trigger the Happy Burst outside the Angular rendering cycle if necessary
				this.triggerHappyBurst(user.firstName);
			}
		});
	}

	ngAfterViewInit(): void {
		if (this.isBrowser) {
			this.socket = io(environment.socketUrl, {
				withCredentials: true,
			});
			this.socket.on('connect', () => {
				console.log('✅ Connected to AI WebSocket');
			});

			// 2. FRONTEND: KINETIC STREAM RECEPTOR
			this.socket.on('avatar_motion_stream', (payload: any) => {
				this.motionQueue.push(payload);
				if (this.motionQueue.length > 30) this.motionQueue.shift(); // Prevent memory leaks
			});

			// 1. INTER-PAGE NAVIGATION JUMP & FLIGHT PATHS
			this.router.events.pipe(
				filter(event => event instanceof NavigationEnd)
			).subscribe(() => {
				if (this.isReady()) {
					this.playJoyfulTransit();
				}
			});
		}

		// Ensure canvas is ready before initializing
		setTimeout(() => {
			// Run everything outside Angular zone for maximum performance
			this.ngZone.runOutsideAngular(() => {
				try {
					if (!this.isBrowser) return;
					this.initScene();
					this.loadRobotModel();
					this.startRenderLoop();
					this.setupResizeHandler();
				} catch (error) {
					console.error('❌ Failed to initialize robot:', error);
					this.onModelError(error);
				}
			});
		}, 0);
	}

	/**
	 * Initialize Three.js Scene
	 */
	private initScene(): void {
		const canvas = this.canvasRef.nativeElement;

		if (!canvas) {
			console.error('❌ Canvas element not found!');
			throw new Error('Canvas element not available');
		}

		console.log('🎨 Initializing Three.js scene');
		console.log('Canvas element:', canvas);
		console.log('Canvas dimensions:', {
			width: canvas.clientWidth,
			height: canvas.clientHeight,
			offsetWidth: canvas.offsetWidth,
			offsetHeight: canvas.offsetHeight
		});

		// Scene with transparent background
		this.scene = new THREE.Scene();
		this.scene.background = null;

		// Camera
		const width = this.isBrowser ? window.innerWidth : 1024;
		const height = this.isBrowser ? window.innerHeight : 768;
		this.camera = new THREE.PerspectiveCamera(
			50,
			width / height,
			0.1,
			100
		);
		this.camera.position.set(0, 0, 5);
		this.camera.lookAt(0, 0, 0);

		console.log('📷 Camera setup:', {
			position: this.camera.position,
			fov: 50,
			aspect: this.camera.aspect
		});

		// Renderer with transparency
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			antialias: true,
			powerPreference: 'high-performance',
		});
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(this.isBrowser ? Math.min(window.devicePixelRatio, 2) : 1);
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;

		console.log('🖼️ Renderer setup:', {
			size: { width: window.innerWidth, height: window.innerHeight },
			pixelRatio: this.renderer.getPixelRatio()
		});

		// Lighting
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
		directionalLight.position.set(5, 10, 7.5);
		this.scene.add(directionalLight);

		const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
		fillLight.position.set(-5, 5, -5);
		this.scene.add(fillLight);

		console.log('💡 Lighting added to scene');

	}

	/**
	 * Load Robot Model with retry logic
	 */
	private loadRobotModel(retryCount = 0): void {
		const maxRetries = 3;
		console.log(`🤖 Loading robot model from: /assets/models/rebooot.glb (attempt ${retryCount + 1}/${maxRetries + 1})`);

		const loader = new GLTFLoader();
		const dracoLoader = new DRACOLoader();
		dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
		loader.setDRACOLoader(dracoLoader);

		loader.load(
			'/assets/models/rebooot.glb',
			(gltf: any) => this.onModelLoaded(gltf),
			(progress: any) => {
				const percent = (progress.loaded / progress.total) * 100;
				console.log(`📦 Loading: ${percent.toFixed(0)}%`);
			},
			(error: any) => {
				console.error(`❌ Load attempt ${retryCount + 1} failed:`, error);

				// Retry if we haven't exceeded max retries
				if (retryCount < maxRetries) {
					console.log(`🔄 Retrying in 1 second...`);
					setTimeout(() => {
						this.loadRobotModel(retryCount + 1);
					}, 1000);
				} else {
					console.error(`❌ Failed to load model after ${maxRetries + 1} attempts`);
					this.onModelError(error);
				}
			}
		);
	}

	/**
	 * Handle successful model load
	 */
	private onModelLoaded(gltf: any): void {
		console.log('✅ Robot model loaded successfully!');
		this.robotModel = gltf.scene;

		// Optimize materials
		this.robotModel.traverse((child: any) => {
			if ((child as THREE.Mesh).isMesh) {
				const mesh = child as THREE.Mesh;
				mesh.frustumCulled = true;
				if (mesh.material) {
					(mesh.material as THREE.Material).needsUpdate = false;
				}
			}
		});

		// Scale and center model
		const box = new THREE.Box3().setFromObject(this.robotModel);
		const size = box.getSize(new THREE.Vector3());
		const maxDim = Math.max(size.x, size.y, size.z);
		const scale = 1.5 / maxDim;
		this.robotModel.scale.setScalar(scale);

		const center = box.getCenter(new THREE.Vector3());
		this.robotModel.position.x = -center.x * scale;
		this.robotModel.position.y = -center.y * scale;
		this.robotModel.position.z = -center.z * scale;

		// Start at HIDDEN position
		this.robotModel.position.set(
			POSITIONS['HIDDEN'].x,
			POSITIONS['HIDDEN'].y,
			POSITIONS['HIDDEN'].z
		);

		console.log('📍 Robot positioned at HIDDEN:', this.robotModel.position);

		this.scene.add(this.robotModel);
		console.log('🎬 Robot added to scene');

		// KINETIC STREAM RECEPTOR BONE CACHING
		this.robotModel.traverse((child: any) => {
			if (child.isBone) {
				// Cache exactly by name for mapping the streaming payload
				this.bones[child.name] = child;
				child.matrixAutoUpdate = true;
			}
		});

		console.log(`🦴 Cached ${Object.keys(this.bones).length} bones for streaming receptor`);
		console.log('✅ Using Backend-Streamed Kinetic Receptor Architecture');

		this.ngZone.run(() => {
			this.isLoading.set(false);
			this.isReady.set(true);
			this.cdr.markForCheck();
		});

		console.log('✅ Procedural Robot Engine is ready!');
	}

	/**
	 * Handle model load error
	 */
	private onModelError(error: any): void {
		console.error('Failed to load robot model:', error);
		this.ngZone.run(() => {
			this.loadError.set('فشل تحميل المساعد الذكي');
			this.isLoading.set(false);
			this.cdr.markForCheck();
		});
	}

	/**
	 * Render loop
	 */
	private startRenderLoop(): void {
		let frameCount = 0;

		const render = () => {
			this.animationFrameId = requestAnimationFrame(render);

			// KINETIC STREAM RECEPTOR RENDER LOOP
			if (this.motionQueue.length > 0) {
				const frame = this.motionQueue.shift();

				if (frame.bones) {
					for (const boneName in frame.bones) {
						if (this.bones[boneName]) {
							const target = frame.bones[boneName];
							// Tight LERP for absolute smoothness
							this.bones[boneName].rotation.x = THREE.MathUtils.lerp(this.bones[boneName].rotation.x, target.x, 0.15);
							this.bones[boneName].rotation.y = THREE.MathUtils.lerp(this.bones[boneName].rotation.y, target.y, 0.15);
							this.bones[boneName].rotation.z = THREE.MathUtils.lerp(this.bones[boneName].rotation.z, target.z, 0.15);
						}
					}
				}

				this.isWalking = frame.locomotion?.isWalking || false;
			}

			// Procedural Locomotion (Hip Sway)
			if (this.isWalking && this.robotModel && !gsap.isTweening(this.robotModel.position)) {
				this.robotModel.position.y += Math.sin(Date.now() * 0.015) * 0.05;
				this.robotModel.position.x += Math.cos(Date.now() * 0.008) * 0.02;
			}

			// Render scene
			this.renderer.render(this.scene, this.camera);

			// Log first few frames to verify rendering
			frameCount++;
			if (frameCount === 1) {
				console.log('🎬 First frame rendered!');
				console.log('Scene children count:', this.scene.children.length);
				console.log('Camera position:', this.camera.position);
			}
			if (frameCount === 60) {
				console.log('✅ 60 frames rendered successfully');
			}
		};

		render();
		console.log('🔄 Render loop started');
	}

	/**
	 * Move robot to preset position using GSAP
	 */
	public moveTo(
		positionKey: string,
		duration = 1.5,
		ease = 'power2.inOut'
	): Promise<void> {
		const targetPos = POSITIONS[positionKey];
		if (!targetPos) {
			return Promise.reject(`Position "${positionKey}" not found`);
		}

		return new Promise((resolve) => {
			// Kill existing tweens
			this.killTweens();

			this.emitMotionState(true, 0.5, 0.1, 'IDLE');

			// Animate position
			const positionTween = gsap.to(this.robotModel.position, {
				x: targetPos.x,
				y: targetPos.y,
				z: targetPos.z,
				duration,
				ease,
				onComplete: () => {
					this.emitMotionState(false, 0.5, 0.1, 'IDLE');
					resolve();
				},
			});

			// Animate rotation if specified
			if (targetPos.rotY !== undefined) {
				const rotationTween = gsap.to(this.robotModel.rotation, {
					y: targetPos.rotY,
					duration,
					ease,
				});
				this.activeTweens.push(rotationTween);
			}

			this.activeTweens.push(positionTween);
		});
	}

	/**
	 * Start Experience - User interaction to unlock audio and begin sequence
	 */
	public startExperience(): void {
		// Update state
		this.ngZone.run(() => {
			this.hasStarted.set(true);
			this.cdr.markForCheck();
		});

		// Force load voices and wait
		const loadVoices = () => {
			return new Promise<SpeechSynthesisVoice[]>((resolve) => {
				let voices = this.synth.getVoices();

				if (voices.length > 0) {
					console.log('✅ Voices already loaded:', voices.length);
					resolve(voices);
					return;
				}

				// Wait for voiceschanged event
				const onVoicesChanged = () => {
					voices = this.synth.getVoices();
					console.log('✅ Voices loaded after event:', voices.length);
					if (voices.length > 0) {
						resolve(voices);
					}
				};

				this.synth.addEventListener('voiceschanged', onVoicesChanged, { once: true });

				// Fallback: check again after 1 second
				setTimeout(() => {
					voices = this.synth.getVoices();
					console.log('⏱️ Voices after timeout:', voices.length);
					resolve(voices);
				}, 1000);
			});
		};

		// Initialize audio
		loadVoices().then((voices) => {
			console.log('📢 Total available voices:', voices.length);

			if (voices.length > 0) {
				// Log all available voices for debugging
				console.log('🔊 Available voices:');
				voices.forEach(v => console.log(`  - ${v.name} (${v.lang}) ${v.default ? '[DEFAULT]' : ''}`));

				// Log Arabic voices
				const arabicVoices = voices.filter(v =>
					v.lang.startsWith('ar') || v.name.toLowerCase().includes('arabic')
				);
				console.log('🇸🇦 Arabic voices found:', arabicVoices.length);
				if (arabicVoices.length === 0) {
					console.warn('⚠️ No Arabic voices found. Chrome on Linux typically doesn\'t include Arabic voices.');
					console.warn('💡 The robot will use the default voice. For better Arabic support, consider using Windows/macOS or a TTS API service.');
				} else {
					arabicVoices.forEach(v => console.log(`  - ${v.name} (${v.lang})`));
				}
			} else {
				console.warn('⚠️ No TTS voices available. Speech will be silent.');
			}

			// Play a test utterance to fully unlock audio
			const testUnlock = new SpeechSynthesisUtterance('مرحبا');
			testUnlock.volume = 0.1; // Very quiet
			testUnlock.rate = 2; // Fast
			testUnlock.lang = 'ar-SA';

			testUnlock.onstart = () => console.log('✅ Test audio started - Audio fully unlocked!');
			testUnlock.onerror = (e) => console.warn('⚠️ Test audio failed:', e.error);

			this.synth.speak(testUnlock);

			// Wait a moment for test to complete, then start intro
			setTimeout(() => {
				console.log('🎬 Starting intro sequence...');
				this.playIntroSequence();
			}, 500);
		});
	}

	private emitMotionState(isWalking: boolean, excitement: number, gestureFreq: number, pose: string = 'IDLE') {
		if (this.socket) {
			this.socket.emit('set_motion_state', { isWalking, excitement, gestureFreq, pose });
		}
	}

	/**
	 * Intro sequence: HIDDEN → CENTER → speak → ASSISTANT
	 */
	private async playIntroSequence(): Promise<void> {
		try {
			console.log('🚀 Starting intro sequence...');
			console.log('Current robot position:', this.robotModel.position);

			// Wait a moment for scene to be ready
			await this.delay(500);

			// Fly to center
			console.log('📍 Moving to CENTER position...');
			await this.moveTo('CENTER', 1.5, 'back.out');
			console.log('✅ Reached CENTER position');

			// Wait before speaking
			await this.delay(1500);

			// Welcome message powered by AI backend
			console.log('🎤 Speaking welcome message...');
			await this.speak('');
			console.log('✅ Speech completed (or failed gracefully)');

			// Wait 8 seconds
			await this.delay(8000);

			// Move to assistant position
			console.log('📍 Moving to ASSISTANT position...');
			await this.moveTo('ASSISTANT', 1.2, 'power2.inOut');
			console.log('✅ Intro sequence complete!');
		} catch (error) {
			console.error('❌ Intro sequence failed:', error);
		}
	}

	/**
	 * Inter-page Navigation Jump (Joyful Transit sequence)
	 */
	private playJoyfulTransit(): void {
		if (!this.robotModel || gsap.isTweening(this.robotModel.position)) return;

		console.log('🚀 Executing Joyful Transit sequence...');

		// Instantly play energetic spin/burst animation
		this.emitMotionState(true, 0.8, 0.5, 'IDLE');

		const currentX = this.robotModel.position.x;
		// Pick a random target X that is on the opposite side to make it cross the screen
		const targetX = currentX > 0 ? (Math.random() * -1 - 1) : (Math.random() * 1 + 1);

		gsap.to(this.robotModel.position, {
			x: targetX,
			y: POSITIONS['ASSISTANT'].y,
			duration: 1.5,
			ease: "back.out(1.7)",
			onComplete: () => {
				this.emitMotionState(false, 0.5, 0.1, 'IDLE');
			}
		});

		// Dynamic 360 spin
		gsap.to(this.robotModel.rotation, {
			y: this.robotModel.rotation.y + Math.PI * 2,
			duration: 1.2,
			ease: "power2.inOut"
		});
	}

	/**
	 * Owner Detected Excitement State (Happy Burst)
	 */
	private async triggerHappyBurst(ownerName: string): Promise<void> {
		if (!this.robotModel) return;

		console.log(`🎉 Owner Detected! Triggering Happy Burst for ${ownerName}`);

		// Quickly fly closer to center / camera
		gsap.to(this.robotModel.position, {
			x: POSITIONS['CENTER'].x,
			y: POSITIONS['CENTER'].y + 0.5,
			z: 1.5, // Move closer
			duration: 1.0,
			ease: "power2.out"
		});

		// Crossfade into celebratory animation stream
		this.emitMotionState(false, 1.0, 1.0, 'CELEBRATORY_JUMP');

		// Trigger high-pitched enthusiastic speech
		await this.speak(`مرحباً بصاحب المكان! سعيد برؤيتك مجدداً يا ${ownerName}!`);

		// Fly back to assistant position
		gsap.to(this.robotModel.position, {
			x: POSITIONS['ASSISTANT'].x,
			y: POSITIONS['ASSISTANT'].y,
			z: POSITIONS['ASSISTANT'].z,
			duration: 1.5,
			ease: "power2.inOut",
			onComplete: () => {
				this.emitMotionState(false, 0.5, 0.1, 'IDLE');
			}
		});
	}



	/**
	 * Make robot speak with animation crossfade and Arabic voice
	 * Uses free google-tts-api via backend
	 */
	public async speak(text: string): Promise<void> {
		// Procedural check: Ensure model is ready
		if (!this.robotModel) {
			console.error('❌ Animations not initialized');
			return;
		}

		// Cancel any existing speech/audio
		if (this.isBrowser) window.speechSynthesis.cancel();
		if (this.currentAudio) {
			this.currentAudio.pause();
			this.currentAudio = undefined;
		}

		try {
			console.log('🎤 Requesting AI TTS via WebSocket...');

			const token = this.authStore.token();

			return new Promise((resolve) => {
				const timeoutId = setTimeout(() => {
					this.socket.off('ai_chat_response');
					console.warn('⚠️ WebSocket Timeout. Falling back to browser TTS.');
					resolve(this.speakWithBrowserTTS(text || 'مرحباً'));
				}, 15000);

				this.socket.once('ai_chat_response', (result: any) => {
					clearTimeout(timeoutId);

					const aiText = result.data?.text || text;

					if (!result.success || !result.data?.audioBase64) {
						console.warn('⚠️ No audio returned from AI assistant via WS. Falling back to browser TTS with AI text.');
						resolve(this.speakWithBrowserTTS(aiText));
						return;
					}

					// Convert base64 to Blob
					const audioData = atob(result.data.audioBase64);
					const arrayBuffer = new ArrayBuffer(audioData.length);
					const view = new Uint8Array(arrayBuffer);
					for (let i = 0; i < audioData.length; i++) {
						view[i] = audioData.charCodeAt(i);
					}
					const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
					const audioUrl = URL.createObjectURL(audioBlob);

					this.currentAudio = new Audio(audioUrl);

					// Animation sync: Start talking when audio plays
					this.currentAudio.onplay = () => {
						this.ngZone.run(() => {
							this.isSpeaking.set(true);
							this.cdr.markForCheck();
						});

						console.log('🎤 Arabic speech started - Dynamic animation active');
					};

					// Timeline Animation Sync
					this.currentAudio.ontimeupdate = () => {
						const timeline = result.data?.speechTimeline || [];
						if (timeline.length === 0) {
							this.emitMotionState(false, 0.8, 0.5, 'WELCOME_OPEN');
							return;
						}

						const duration = this.currentAudio?.duration || 0;
						if (!duration || isNaN(duration) || !isFinite(duration)) {
							this.emitMotionState(false, 0.8, 0.5, 'WELCOME_OPEN');
							return;
						}

						const currentTime = this.currentAudio?.currentTime || 0;
						const timePerChar = duration / aiText.length;

						let accumulatedTime = 0;
						let activeCue = 'WELCOME_OPEN';
						let activeExcitement = 0.5;
						let activeGestureFreq = 1.0;

						for (const segment of timeline) {
							const segDuration = segment.textSegment.length * timePerChar;
							const start = accumulatedTime;
							const end = accumulatedTime + segDuration;
							accumulatedTime += segDuration;

							if (currentTime >= start && currentTime <= end) {
								activeCue = segment.bodyLanguagePose || segment.animationCue || 'WELCOME_OPEN';
								activeExcitement = segment.excitementLevel !== undefined ? segment.excitementLevel : 0.5;
								activeGestureFreq = segment.gestureFrequency !== undefined ? segment.gestureFrequency : 1.0;
								break;
							}
						}

						// 3. AI QUANTUM SPEECH SYNC
						this.emitMotionState(false, activeExcitement, activeGestureFreq, activeCue);
					};

					// Animation sync: Return to idle when audio ends
					this.currentAudio.onended = () => {
						this.emitMotionState(false, 0.5, 0.1, 'IDLE');

						this.ngZone.run(() => {
							this.isSpeaking.set(false);
							this.cdr.markForCheck();
						});

						URL.revokeObjectURL(audioUrl);
						console.log('✅ Arabic speech ended - Idle animation active');
						resolve();
					};

					// Handle errors gracefully
					this.currentAudio.onerror = (error) => {
						console.error('❌ Audio playback error:', error);
						this.emitMotionState(false, 0.5, 0.1, 'IDLE');

						this.ngZone.run(() => {
							this.isSpeaking.set(false);
							this.cdr.markForCheck();
						});

						URL.revokeObjectURL(audioUrl);
						resolve(this.speakWithBrowserTTS(aiText));
					};

					// Play audio
					this.currentAudio.play().catch(async (e) => {
						console.warn('⚠️ Audio play failed (possibly blocked by browser). Attempting to use browser TTS.', e);
						resolve(this.speakWithBrowserTTS(aiText));
					});
				});

				this.socket.emit('ai_chat', {
					message: text || "مرحباً",
					token: token,
					currentRoute: this.isBrowser ? window.location.pathname : '/'
				});
			});

		} catch (error) {
			// Fallback to browser SpeechSynthesis API
			console.warn('⚠️ WebSocket setup failed, falling back to browser TTS:', error);
			return this.speakWithBrowserTTS(text);
		}
	}

	/**
	 * Speak using browser's built-in TTS
	 */
	private speakWithBrowserTTS(text: string): Promise<void> {
		return new Promise((resolve) => {
			// Procedural safety check
			if (!this.robotModel) {
				console.error('❌ Animations not initialized');
				resolve(); // Don't block the sequence
				return;
			}

			// Check if voices are available
			const voices = this.synth.getVoices();
			if (voices.length === 0) {
				console.warn('⚠️ No voices available - Simulating speech with animation only');

				// Animate without audio - estimate duration
				const words = text.split(' ').length;
				const estimatedDuration = (words / 2.5) * 1000; // ~2.5 words per second

				// Start talking animation
				this.emitMotionState(false, 0.6, 0.8, 'INSTRUCTIVE_DIRECTING');

				this.ngZone.run(() => {
					this.isSpeaking.set(true);
					this.cdr.markForCheck();
				});

				// Wait for estimated duration
				setTimeout(() => {
					this.emitMotionState(false, 0.5, 0.1, 'IDLE');

					this.ngZone.run(() => {
						this.isSpeaking.set(false);
						this.cdr.markForCheck();
					});

					console.log('✅ Silent animation complete');
					resolve();
				}, estimatedDuration);

				return;
			}

			// Cancel any ongoing speech to prevent overlapping audio
			this.synth.cancel();

			// Update speaking state
			this.ngZone.run(() => {
				this.isSpeaking.set(true);
				this.cdr.markForCheck();
			});

			// Create utterance
			this.currentUtterance = new SpeechSynthesisUtterance(text);
			this.currentUtterance.lang = 'ar-SA';
			this.currentUtterance.rate = 1.0;
			this.currentUtterance.pitch = 1.0;
			this.currentUtterance.volume = 1.0;

			// Try to find a specific Arabic voice
			const arabicVoice = voices.find((voice: any) =>
				voice.lang === 'ar-SA' ||
				voice.lang.startsWith('ar') ||
				voice.name.toLowerCase().includes('arabic')
			);

			if (arabicVoice) {
				this.currentUtterance.voice = arabicVoice;
				console.log('🎤 Using Arabic voice:', arabicVoice.name, `(${arabicVoice.lang})`);
			} else {
				// Fallback: try to find a natural-sounding voice
				const naturalVoice = voices.find((v: any) =>
					v.name.includes('Google') ||
					v.name.includes('Natural') ||
					v.name.includes('Enhanced')
				) || voices.find((v: any) => v.default) || voices[0];

				if (naturalVoice) {
					this.currentUtterance.voice = naturalVoice;
					console.log('🎤 Using fallback voice:', naturalVoice.name, `(${naturalVoice.lang})`);
					console.warn('⚠️ No Arabic voice available. Using', naturalVoice.name);
				}
			}

			// Handle speech start
			this.currentUtterance.onstart = () => {
				// Ensure Talking animation is playing with smooth CrossFade (0.2s)
				this.emitMotionState(false, 0.6, 0.8, 'INSTRUCTIVE_DIRECTING');

				console.log('🎤 Speech started - Talking animation active');
			};

			// Handle speech end
			this.currentUtterance.onend = () => {
				// CrossFade back to Idle animation (0.2s)
				this.emitMotionState(false, 0.5, 0.1, 'IDLE');

				// Update state
				this.ngZone.run(() => {
					this.isSpeaking.set(false);
					this.cdr.markForCheck();
				});

				console.log('Speech ended - Idle animation active');
				resolve();
			};

			// Handle speech errors (browser policy, network issues, etc.)
			this.currentUtterance.onerror = (event) => {
				console.error('❌ Speech synthesis error:', event.error || event);

				// Fallback: crossfade back immediately
				this.emitMotionState(false, 0.5, 0.1, 'IDLE');

				this.ngZone.run(() => {
					this.isSpeaking.set(false);
					this.cdr.markForCheck();
				});

				// Resolve instead of reject to continue the sequence
				resolve();
			};

			// Start speaking with browser policy handling
			try {
				this.synth.speak(this.currentUtterance);
			} catch (error) {
				console.error('❌ Speech synthesis blocked:', error);

				// Revert to idle animation
				this.emitMotionState(false, 0.5, 0.1, 'IDLE');

				this.ngZone.run(() => {
					this.isSpeaking.set(false);
					this.cdr.markForCheck();
				});

				// Resolve instead of reject to continue the sequence
				resolve();
			}
		});
	}

	/**
	 * Handle window resize
	 */
	private setupResizeHandler(): void {
		if (!this.isBrowser) return;

		const handleResize = () => {
			if (!this.camera || !this.renderer) return;

			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(window.innerWidth, window.innerHeight);
		};

		window.addEventListener('resize', handleResize);
	}

	/**
	 * Kill active GSAP tweens
	 */
	private killTweens(): void {
		this.activeTweens.forEach(tween => tween.kill());
		this.activeTweens = [];
	}

	/**
	 * Utility delay
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Cleanup
	 */
	ngOnDestroy(): void {
		// Stop speech
		if (this.synth) {
			this.synth.cancel();
		}

		if (this.socket) {
			this.socket.disconnect();
		}

		// Stop audio if playing
		if (this.currentAudio) {
			this.currentAudio.pause();
			this.currentAudio = undefined;
		}

		// Stop render loop
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
		}

		// Kill all tweens
		this.killTweens();
		if (this.robotModel) {
			gsap.killTweensOf(this.robotModel.position);
			gsap.killTweensOf(this.robotModel.rotation);
		}

		if (this.renderer) {
			this.renderer.dispose();
		}

		if (this.robotModel) {
			this.robotModel.traverse((child: any) => {
				if ((child as THREE.Mesh).isMesh) {
					const mesh = child as THREE.Mesh;
					if (mesh.geometry) mesh.geometry.dispose();
					if (mesh.material) {
						if (Array.isArray(mesh.material)) {
							mesh.material.forEach((mat: any) => this.disposeMaterial(mat));
						} else {
							this.disposeMaterial(mesh.material);
						}
					}
				}
			});
		}

		if (this.renderer) {
			this.renderer.dispose();
		}

		if (this.scene) {
			this.scene.clear();
		}
	}

	private disposeMaterial(material: THREE.Material): void {
		Object.keys(material).forEach((key) => {
			const value = (material as any)[key];
			if (value && value.isTexture) {
				value.dispose();
			}
		});
		material.dispose();
	}
}
