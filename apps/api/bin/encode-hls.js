#!/usr/bin/env node
import inquirer from "inquirer";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";

function genFilmId() {
  return "film_" + crypto.randomBytes(4).toString("hex");
}

async function main() {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "input",
      message: "MP4 input path:",
      validate: (v) => fs.existsSync(path.resolve(v)) || "File not found",
      default: "/Users/admin/Downloads/bbb_sunflower_1080p_30fps_normal.mp4",
    },
    {
      type: "input",
      name: "outputRoot",
      message: "Output root folder:",
      default: "../web/public/films",
    },
    {
      type: "list",
      name: "resolution",
      message: "Resolution:",
      choices: ["720p", "1080p"],
      default: "1080p",
    },
  ]);

  const inputPath = path.resolve(answers.input);
  const outputRoot = path.resolve(answers.outputRoot);
  const filmId = genFilmId();
  const outputDir = path.join(outputRoot, filmId);

  fs.mkdirSync(outputDir, { recursive: true });

  const bitrateMap = {
    "720p": "2500k",
    "1080p": "4500k",
  };

  console.log("🎬 Film ID:", filmId);
  console.log("📥 Input :", inputPath);
  console.log("📤 Output:", outputDir);

  const gop = 60; // 2s @ 30fps (ổn hơn DEV)

  const args = [
    "-y",
    "-fflags",
    "+genpts",
    "-avoid_negative_ts",
    "make_zero",
    "-i",
    inputPath,

    // ===== VIDEO =====
    "-map",
    "0:v:0",
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",

    "-r",
    "30",
    "-g",
    String(gop),
    "-keyint_min",
    String(gop),
    "-sc_threshold",
    "0",
    "-force_key_frames",
    "expr:gte(t,n_forced*2)",

    "-b:v",
    bitrateMap[answers.resolution],
    "-maxrate",
    bitrateMap[answers.resolution],
    "-bufsize",
    `${parseInt(bitrateMap[answers.resolution]) * 2}k`,

    // ===== AUDIO =====
    "-map",
    "0:a:0",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "48000",

    // ===== HLS =====
    "-f",
    "hls",
    "-hls_time",
    "2",
    "-hls_playlist_type",
    "vod",
    "-hls_flags",
    "independent_segments+split_by_time",
    "-hls_segment_type",
    "mpegts",
    "-hls_segment_filename",
    path.join(outputDir, "seg_%03d.ts"),

    path.join(outputDir, "index.m3u8"),
  ];

  console.log("🚀 Encoding HLS (.ts)...");

  const ff = spawn("ffmpeg", args, { stdio: "inherit" });

  ff.on("close", (code) => {
    if (code === 0) {
      console.log("✅ Convert completed!");
      console.log(`▶️ Play: /films/${filmId}/index.m3u8`);
    } else {
      console.error("❌ FFmpeg failed with code", code);
    }
  });
}

main();
