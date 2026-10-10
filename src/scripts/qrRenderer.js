import QRCode, { QRCodeModel, QRErrorCorrectLevel, getTypeNumber } from './qrcode.js';

export const DEFAULTS = {
	size: 512,
	border: 4,                  // Quiet zone modules around the QR code
	imageMargin: 0,             // Margin (in modules) indented inside the QR code
	imageMode: "background",    // "background" (mosaic art) or "center" (logo badge)
	dotSize: 100,               // Default full scale when no image
	whiteDotSize: 100,          // Default full scale when no image
	dotRoundness: 0,            // 0 to 100 (%)
	dotStyle: "square",         // "square", "rounded", "dots", "classy"
	finderStyle: "square",      // "square", "rounded", "dot"
	finderRoundness: 100,       // Default full scale when no image (0 to 100%)
	errorLevel: "H",            // "H" (30% recovery) recommended for images
	foreground: "#000000",
	background: "#ffffff",
	drawWhiteDots: true,        // Draw un-encoded (false) bits in white
	transparentBackground: false,
	bgOpacity: 0                // 0.0 to 0.8 (tint overlay)
};

let bgImage = null;
let lastModel = null;
let lastOptions = null;
let lastText = "";

function clamp(value, min, max, fallback) {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

function color(value, fallback) {
	return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || "") ? value : fallback;
}

export function normalize(opts) {
	const o = Object.assign({}, DEFAULTS, opts || {});
	return {
		size: Math.round(clamp(o.size, 64, 4096, DEFAULTS.size)),
		border: Math.round(clamp(o.border, 0, 20, DEFAULTS.border)),
		imageMargin: Math.round(clamp(o.imageMargin, 0, 10, DEFAULTS.imageMargin)),
		imageMode: ["background", "center"].includes(o.imageMode) ? o.imageMode : "background",
		dotSize: clamp(o.dotSize, 0, 100, DEFAULTS.dotSize),
		whiteDotSize: clamp(o.whiteDotSize !== undefined ? o.whiteDotSize : o.dotSize, 0, 100, DEFAULTS.whiteDotSize),
		dotRoundness: clamp(o.dotRoundness, 0, 100, DEFAULTS.dotRoundness) / 100,
		dotStyle: ["square", "rounded", "dots", "classy"].includes(o.dotStyle) ? o.dotStyle : DEFAULTS.dotStyle,
		finderStyle: ["square", "rounded", "dot"].includes(o.finderStyle) ? o.finderStyle : DEFAULTS.finderStyle,
		finderRoundness: clamp(o.finderRoundness !== undefined ? o.finderRoundness : DEFAULTS.finderRoundness, 0, 100, DEFAULTS.finderRoundness) / 100,
		errorLevel: ["L", "M", "Q", "H"].includes(o.errorLevel) ? o.errorLevel : DEFAULTS.errorLevel,
		foreground: color(o.foreground, DEFAULTS.foreground),
		background: color(o.background, DEFAULTS.background),
		drawWhiteDots: o.drawWhiteDots !== false,
		transparentBackground: Boolean(o.transparentBackground),
		bgOpacity: clamp(o.bgOpacity, 0, 0.8, DEFAULTS.bgOpacity)
	};
}

function loadImage(source) {
	return new Promise(function (resolve, reject) {
		if (!source) return reject(new Error("No image source provided."));

		if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
			if (source.complete && source.naturalWidth > 0) return resolve(source);
			source.onload = () => resolve(source);
			source.onerror = () => reject(new Error("Image element failed to load."));
			return;
		}

		if (typeof Blob !== "undefined" && source instanceof Blob) {
			const url = URL.createObjectURL(source);
			const img = new Image();
			img.onload = function () {
				URL.revokeObjectURL(url);
				resolve(img);
			};
			img.onerror = function () {
				URL.revokeObjectURL(url);
				reject(new Error("Image file failed to load."));
			};
			img.src = url;
			return;
		}

		if (typeof source === "string") {
			const img = new Image();
			img.crossOrigin = "anonymous";
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error("Image URL failed to load."));
			img.src = source;
			return;
		}

		reject(new Error("Unsupported image source type."));
	});
}

function addRoundRect(ctx, x, y, w, h, radius) {
	radius = Math.min(radius, w / 2, h / 2);
	if (radius <= 0) {
		ctx.rect(x, y, w, h);
		return;
	}
	ctx.moveTo(x + radius, y);
	ctx.arcTo(x + w, y, x + w, y + h, radius);
	ctx.arcTo(x + w, y + h, x, y + h, radius);
	ctx.arcTo(x, y + h, x, y, radius);
	ctx.arcTo(x, y, x + w, y, radius);
	ctx.closePath();
}

function isFinderZone(row, col, count) {
	return (
		(row <= 7 && col <= 7) ||
		(row <= 7 && col >= count - 8) ||
		(row >= count - 8 && col <= 7)
	);
}

function drawFinder(ctx, x, y, cell, style, roundness, fgColor, bgColor) {
	const size = 7 * cell;
	let rRatio = typeof roundness === "number" && !isNaN(roundness) ? roundness : 0;
	if (rRatio > 1) {
		rRatio = rRatio / 100;
	}
	if (roundness === undefined) {
		if (style === "rounded") rRatio = 0.5;
		else if (style === "dot") rRatio = 1.0;
	}
	rRatio = Math.max(0, Math.min(1, rRatio));

	const outerR = (size / 2) * rRatio;
	const middleR = ((5 * cell) / 2) * rRatio;
	const innerR = ((3 * cell) / 2) * rRatio;

	// 1. Outer 7x7 dark box
	ctx.fillStyle = fgColor;
	ctx.beginPath();
	addRoundRect(ctx, x, y, size, size, outerR);
	ctx.fill();

	// 2. Inner 5x5 WHITE ring (guaranteed white so 1:1:3:1:1 scanner ratio is clean)
	ctx.fillStyle = bgColor;
	ctx.beginPath();
	addRoundRect(ctx, x + cell, y + cell, 5 * cell, 5 * cell, middleR);
	ctx.fill();

	// 3. Center 3x3 dark core
	ctx.fillStyle = fgColor;
	ctx.beginPath();
	addRoundRect(ctx, x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell, innerR);
	ctx.fill();
}

function drawModule(ctx, col, row, cell, dotSize, style, roundness) {
	const radius = (cell * (dotSize / 100)) / 2;
	const width = radius * 2;
	const height = radius * 2;
	const centerX = cell * (col + 0.5);
	const centerY = cell * (row + 0.5);
	const x = centerX - radius;
	const y = centerY - radius;

	ctx.beginPath();
	if (style === "dots") {
		ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
	} else {
		let rRatio = typeof roundness === "number" && !isNaN(roundness) ? roundness : 0;
		if (rRatio > 1) rRatio = rRatio / 100;
		rRatio = Math.max(0, Math.min(1, rRatio));
		const cornerRadius = radius * rRatio;
		addRoundRect(ctx, x, y, width, height, cornerRadius);
	}
	ctx.fill();
}

function drawCoverImage(ctx, image, dx, dy, dSize) {
	if (dSize <= 0 || !image.width || !image.height) return;
	const imgAspect = image.width / image.height;
	let sx = 0, sy = 0, sw = image.width, sh = image.height;
	if (imgAspect > 1) {
		sw = image.height;
		sx = (image.width - sw) / 2;
	} else if (imgAspect < 1) {
		sh = image.width;
		sy = (image.height - sh) / 2;
	}
	ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dSize, dSize);
}

function buildModel(text, level) {
	const ecLevel = (QRErrorCorrectLevel && QRErrorCorrectLevel[level] !== undefined)
		? QRErrorCorrectLevel[level]
		: (QRCode && QRCode.CorrectLevel ? QRCode.CorrectLevel[level] : 2);
	const getTN = getTypeNumber || (QRCode && QRCode.getTypeNumber);
	const typeNum = getTN ? getTN(text, ecLevel) : 1;
	const ModelClass = QRCodeModel || (QRCode && QRCode.QRCodeModel);
	if (!ModelClass) {
		throw new Error("QRCodeModel constructor is not available.");
	}
	const model = new ModelClass(typeNum, ecLevel);
	model.addData(text);
	model.make();
	return model;
}

function draw(model, canvas, options) {
	const matrix = model.modules;
	const qrLength = matrix.length;
	const border = options.border;
	const totalModules = qrLength + border * 2;

	const cell = Math.max(1, Math.floor(options.size / totalModules));
	const canvasSize = cell * totalModules;
	const matrixSize = qrLength * cell;
	const offset = border * cell;

	canvas.width = canvasSize;
	canvas.height = canvasSize;

	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas rendering is not supported.");

	const whiteColor = "#ffffff";
	const bgColor = options.background;
	const fgColor = options.foreground;

	// 1. Draw solid outer canvas background (Quiet zone must be pure white / background)
	if (options.transparentBackground) {
		ctx.clearRect(0, 0, canvasSize, canvasSize);
	} else {
		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 0, canvasSize, canvasSize);
	}

	// 2. If Background image mode: draw image under QR area
	if (bgImage && options.imageMode === "background") {
		const marginPx = options.imageMargin * cell;
		const drawX = offset + marginPx;
		const drawY = offset + marginPx;
		const drawSize = Math.max(0, matrixSize - marginPx * 2);

		ctx.save();
		drawCoverImage(ctx, bgImage, drawX, drawY, drawSize);

		// Optional opacity tint
		if (options.bgOpacity > 0) {
			ctx.fillStyle = bgColor;
			ctx.globalAlpha = options.bgOpacity;
			ctx.fillRect(drawX, drawY, drawSize, drawSize);
		}
		ctx.restore();
	}

	ctx.imageSmoothingEnabled = false;

	// 3. Draw Finder Patterns (Corners) directly over image/background so corners don't get cut off
	const finderLocations = [
		{ row: 0, col: 0 },
		{ row: 0, col: qrLength - 7 },
		{ row: qrLength - 7, col: 0 }
	];

	for (const f of finderLocations) {
		// Draw 7x7 finder pattern directly over the image so corners don't get cut off
		drawFinder(
			ctx,
			(f.col + border) * cell,
			(f.row + border) * cell,
			cell,
			options.finderStyle,
			options.finderRoundness,
			fgColor,
			whiteColor
		);
	}

	// 4. Center Logo calculation (if center mode is active)
	const centerStart = Math.floor(qrLength * 0.36);
	const centerEnd = Math.ceil(qrLength * 0.64);
	const isCenterMode = Boolean(bgImage && options.imageMode === "center");

	function inCenterZone(r, c) {
		return isCenterMode && (r >= centerStart && r < centerEnd && c >= centerStart && c < centerEnd);
	}

	// 5. Draw QR Modules (BOTH Dark Modules AND White Modules to guarantee scannability!)
	for (let row = 0; row < qrLength; row++) {
		for (let col = 0; col < qrLength; col++) {
			if (isFinderZone(row, col, qrLength)) continue;
			if (inCenterZone(row, col)) continue;

			const isDark = matrix[row][col];

			if (isDark) {
				// DARK MODULE
				ctx.fillStyle = fgColor;
				drawModule(
					ctx,
					col + border,
					row + border,
					cell,
					options.dotSize,
					options.dotStyle,
					options.dotRoundness
				);
			} else if (options.drawWhiteDots) {
				// WHITE PORTION: High-contrast pure white module
				ctx.fillStyle = whiteColor;
				drawModule(
					ctx,
					col + border,
					row + border,
					cell,
					options.whiteDotSize,
					options.dotStyle,
					options.dotRoundness
				);
			}
		}
	}

	// 6. Draw Center Logo (if center mode active)
	if (isCenterMode) {
		const czStart = (border + centerStart) * cell;
		const czSize = (centerEnd - centerStart) * cell;
		const pad = Math.max(3, Math.round(cell * 0.5));
		const innerSize = czSize - pad * 2;
		const borderRadius = Math.round(czSize * 0.15);

		ctx.save();
		// White card badge background
		ctx.fillStyle = whiteColor;
		ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
		ctx.shadowBlur = 10;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 2;
		ctx.beginPath();
		addRoundRect(ctx, czStart, czStart, czSize, czSize, borderRadius);
		ctx.fill();

		// Clip image inside card badge
		ctx.shadowColor = "transparent";
		ctx.beginPath();
		addRoundRect(ctx, czStart + pad, czStart + pad, innerSize, innerSize, Math.max(2, borderRadius - 2));
		ctx.clip();
		drawCoverImage(ctx, bgImage, czStart + pad, czStart + pad, innerSize);
		ctx.restore();
	}

	return canvasSize;
}

export function generate(elementId, text, opts) {
	try {
		const host = document.getElementById(elementId);
		if (!host) return "The QR code container was not found.";
		if (!text || !String(text).trim()) return "Enter a link to generate a QR code.";

		const options = normalize(opts);
		const level = (bgImage && (!opts || opts.lockErrorLevel !== false)) ? "H" : options.errorLevel;
		const model = buildModel(String(text), level);
		const canvas = document.createElement("canvas");

		draw(model, canvas, options);

		lastModel = model;
		lastOptions = options;
		lastText = String(text);

		canvas.setAttribute("role", "img");
		canvas.setAttribute("aria-label", "QR code for " + text);

		if (typeof host.replaceChildren === "function") {
			host.replaceChildren(canvas);
		} else {
			host.innerHTML = "";
			host.appendChild(canvas);
		}

		return null;
	} catch (err) {
		console.error("QR generation failed:", err);
		return err && err.message ? err.message : "The QR code could not be generated.";
	}
}

export async function setImage(inputOrFile) {
	try {
		let source = inputOrFile;

		if (typeof inputOrFile === "string") {
			const elem = document.getElementById(inputOrFile);
			if (elem && elem.files) {
				source = elem.files[0];
			} else {
				source = inputOrFile;
			}
		} else if (inputOrFile && inputOrFile.files) {
			source = inputOrFile.files[0];
		} else if (inputOrFile && inputOrFile.target && inputOrFile.target.files) {
			source = inputOrFile.target.files[0];
		}

		if (!source) {
			bgImage = null;
			return null;
		}

		bgImage = await loadImage(source);
		return null;
	} catch (err) {
		console.error("QR image failed:", err);
		bgImage = null;
		return err && err.message ? err.message : "Image could not be read.";
	}
}

export function clearImage(inputId) {
	bgImage = null;
	if (inputId) {
		const input = document.getElementById(inputId);
		if (input) input.value = "";
	}
}

export function hasImage() {
	return Boolean(bgImage);
}

export function download(elementId, fileName, targetSize) {
	const host = document.getElementById(elementId);
	if (!host) return;

	let canvas = host.querySelector("canvas");
	if (!canvas) return;

	let exportCanvas = canvas;
	const reqSize = Number(targetSize);
	if (reqSize && reqSize > 0 && lastModel && lastOptions && reqSize !== canvas.width) {
		exportCanvas = document.createElement("canvas");
		const exportOpts = Object.assign({}, lastOptions, { size: reqSize });
		draw(lastModel, exportCanvas, exportOpts);
	}

	const name = fileName || "qr-image.png";

	if (exportCanvas.toBlob) {
		exportCanvas.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.download = name;
			link.href = url;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(url), 10000);
		}, "image/png");
	} else {
		const link = document.createElement("a");
		link.download = name;
		link.href = exportCanvas.toDataURL("image/png");
		document.body.appendChild(link);
		link.click();
		link.remove();
	}
}

export async function copyToClipboard(elementId) {
	const host = document.getElementById(elementId);
	if (!host) return false;

	const canvas = host.querySelector("canvas");
	if (!canvas) return false;

	if (!navigator.clipboard || !window.ClipboardItem) {
		throw new Error("Clipboard API not supported in this browser.");
	}

	return new Promise((resolve, reject) => {
		canvas.toBlob(async (blob) => {
			if (!blob) return reject(new Error("Failed to create blob from canvas."));
			try {
				await navigator.clipboard.write([
					new ClipboardItem({ "image/png": blob })
				]);
				resolve(true);
			} catch (err) {
				reject(err);
			}
		}, "image/png");
	});
}

export default {
	generate,
	setImage,
	clearImage,
	hasImage,
	download,
	copyToClipboard,
	normalize,
	DEFAULTS
};
