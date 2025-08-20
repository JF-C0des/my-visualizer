import React, { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCcw, SlidersHorizontal, Sun, Moon, Play, Pause } from "lucide-react";

// Neon color palette
const NEON_COLORS = [
	"rgba(255, 0, 255, 1)", // Neon Pink/Magenta
	"rgba(0, 255, 255, 1)", // Neon Cyan
	"rgba(255, 255, 0, 1)", // Neon Yellow
	"rgba(57, 255, 20, 1)", // Neon Green
	"rgba(0, 191, 255, 1)", // Neon Blue
	"rgba(255, 105, 180, 1)", // Hot Pink
	"rgba(255, 140, 0, 1)", // Dark Orange (as a bright color)
];

// This is a simple class to represent an individual shape
const Shape = function (width, height) {
	// The constructor now takes width and height to generate random coordinates.
	this.x = Math.random() * width;
	this.y = Math.random() * height;
	this.radius = 30;
	this.numVertices = Math.floor(Math.random() * 8) + 3;
	// Use a random color from the neon palette
	this.color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
	this.lifespan = 255;
};

// The main application component
const App = () => {
	const canvasRef = useRef(null);
	const [shapes, setShapes] = useState([]);
	const [connectionStatus, setConnectionStatus] = useState("Connecting...");
	const [isDarkMode, setIsDarkMode] = useState(true);
	const [isPlaying, setIsPlaying] = useState(true);
	const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
	const [retryCount, setRetryCount] = useState(0);
	const [settings, setSettings] = useState({
		rhythmFactor: 0.05,
		decayRate: 0.98,
		maxShapes: 50,
	});

	const ws = useRef(null);
	const animationFrameId = useRef(null);

	const settingsRef = useRef(settings);
	settingsRef.current = settings;

	const canvasDimensionsRef = useRef(canvasDimensions);
	canvasDimensionsRef.current = canvasDimensions;

	// --- WebSocket Connection Logic ---
	useEffect(() => {
		const connectWebSocket = () => {
			ws.current = new WebSocket("ws://localhost:8766");

			ws.current.onopen = () => {
				setConnectionStatus("Connected!");
				setRetryCount(0);
				console.log("Connected to WebSocket server");
			};

			ws.current.onclose = () => {
				setRetryCount((prev) => {
					if (prev < 4) {
						setConnectionStatus(`Disconnected. Retrying... (${prev + 1}/5)`);
						setTimeout(connectWebSocket, 3000);
						return prev + 1;
					} else if (prev === 4) {
						setConnectionStatus("Disconnected. Retry limit reached. Please refresh to reconnect.");
						return prev + 1;
					} else {
						return prev;
					}
				});
			};

			ws.current.onerror = (error) => {
				console.error("WebSocket error:", error);
			};

			ws.current.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					const currentSettings = settingsRef.current;
					const currentDimensions = canvasDimensionsRef.current;

					setShapes((prevShapes) => {
						let newShapes = [...prevShapes];

						if (data.is_drum_kick) {
							// Pass canvas dimensions to the Shape constructor
							newShapes.push(new Shape(currentDimensions.width, currentDimensions.height));
							if (newShapes.length > currentSettings.maxShapes) {
								newShapes = newShapes.slice(-currentSettings.maxShapes);
							}
						}

						const updatedAndFilteredShapes = newShapes
							.map((shape) => {
								const newRadius =
									shape.radius +
									data.rhythm_factor * currentSettings.rhythmFactor * shape.radius -
									1;
								const newLifespan = shape.lifespan * currentSettings.decayRate;
								return {
									...shape,
									radius: newRadius,
									lifespan: newLifespan,
								};
							})
							.filter((shape) => shape.lifespan > 1);

						return updatedAndFilteredShapes;
					});
				} catch (error) {
					console.error("Failed to parse WebSocket message:", error);
				}
			};
		};

		connectWebSocket();

		return () => {
			if (ws.current) ws.current.close();
		};
		// eslint-disable-next-line
	}, []);

	// --- Animation Loop Logic ---
	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		shapes.forEach((shape) => {
			ctx.beginPath();
			const points = [];
			for (let i = 0; i < shape.numVertices; i++) {
				const angle = (2 * Math.PI * i) / shape.numVertices;
				const x = shape.x + shape.radius * Math.cos(angle);
				const y = shape.y + shape.radius * Math.sin(angle);
				points.push({ x, y });
			}

			ctx.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i++) {
				ctx.lineTo(points[i].x, points[i].y);
			}
			ctx.closePath();

			const [r, g, b] = shape.color.match(/\d+/g).map(Number);
			ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${shape.lifespan / 255})`;
			ctx.lineWidth = 5;
			ctx.stroke();
		});

		animationFrameId.current = requestAnimationFrame(draw);
	}, [shapes]);

	useEffect(() => {
		if (isPlaying) {
			animationFrameId.current = requestAnimationFrame(draw);
		} else {
			cancelAnimationFrame(animationFrameId.current);
		}

		return () => cancelAnimationFrame(animationFrameId.current);
	}, [isPlaying, draw]);

	// --- Event Handlers & UI Setup ---
	useEffect(() => {
		const handleResize = () => {
			const canvas = canvasRef.current;
			if (canvas) {
				setCanvasDimensions({ width: canvas.clientWidth, height: canvas.clientHeight });
			}
		};
		window.addEventListener("resize", handleResize);
		handleResize();
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	const handleSliderChange = (key, value) => {
		setSettings((prev) => ({ ...prev, [key]: value }));
	};

	const handleToggleDarkMode = () => setIsDarkMode((prev) => !prev);
	const handleTogglePlayPause = () => setIsPlaying((prev) => !prev);
	const handleReset = () => setShapes([]);

	return (
		<div className={`w-full h-screen font-sans transition-colors duration-500 relative ${isDarkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"}`}>
			{/* Canvas for Visualizer */}
			<div className="absolute inset-0 z-0">
				<canvas
					ref={canvasRef}
					width={canvasDimensions.width}
					height={canvasDimensions.height}
					className="absolute top-0 left-0 w-full h-full"
				/>
			</div>

			{/* UI Controls: Play, Pause, Reset, Dark Mode, Settings */}
			<div className="absolute top-4 left-4 z-10 flex space-x-2">
				<button
					onClick={handleTogglePlayPause}
					className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200">
					{isPlaying ? <Pause size={20} /> : <Play size={20} />}
				</button>
				<button
					onClick={handleReset}
					className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200">
					<RefreshCcw size={20} />
				</button>
			</div>
			<div className="absolute top-4 right-4 z-10 flex space-x-2">
				<button
					onClick={handleToggleDarkMode}
					className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200">
					{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
				</button>
				<div className="relative group">
					<button className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200">
						<SlidersHorizontal size={20} />
					</button>
					<div className="absolute top-12 right-0 w-80 p-4 rounded-2xl shadow-2xl transition-all duration-300 transform scale-95 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
						<div className="grid gap-4">
							<div className="space-y-2">
								<h4 className="font-medium leading-none">Settings</h4>
								<p className="text-sm text-gray-500">Adjust visualizer parameters.</p>
							</div>
							<div className="grid gap-2">
								<label className="text-sm">Rhythm Pulse ({settings.rhythmFactor.toFixed(2)})</label>
								<input
									type="range"
									min="0.005"
									max="0.2"
									step="0.005"
									value={settings.rhythmFactor}
									onChange={(e) => handleSliderChange("rhythmFactor", parseFloat(e.target.value))}
									className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
								/>
								<label className="text-sm">Decay Rate ({settings.decayRate.toFixed(3)})</label>
								<input
									type="range"
									min="0.9"
									max="0.999"
									step="0.001"
									value={settings.decayRate}
									onChange={(e) => handleSliderChange("decayRate", parseFloat(e.target.value))}
									className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
								/>
								<label className="text-sm">Max Shapes ({settings.maxShapes})</label>
								<input
									type="range"
									min="10"
									max="200"
									step="10"
									value={settings.maxShapes}
									onChange={(e) => handleSliderChange("maxShapes", parseInt(e.target.value))}
									className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			{/* Status Info (now absolutely positioned) */}
			<div
				className={`absolute bottom-4 left-4 z-10 w-full max-w-sm rounded-2xl shadow-xl p-6 transition-colors duration-300 ${
					isDarkMode
						? "bg-gray-800 border-gray-700 text-gray-100"
						: "bg-white border-gray-200 text-gray-900"
				}`}>
				<h2 className="text-2xl font-bold">Generative Music Visualizer</h2>
				<p className="text-sm text-gray-500 mt-2">{connectionStatus}</p>
			</div>
		</div>
	);
};

export default App;