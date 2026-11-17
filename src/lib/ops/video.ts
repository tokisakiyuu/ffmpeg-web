/** Shared encoding settings for picture filters; optional audio mapping accepts silent inputs. */
export function buildVideoArgs(
  inputPath: string,
  outputPath: string,
  videoFilter: string,
  audioFilter?: string,
): string[] {
  return [
    '-i', inputPath,
    '-map', '0:v:0',
    '-map', '0:a?',
    '-vf', `${videoFilter},pad=ceil(iw/2)*2:ceil(ih/2)*2`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    ...(audioFilter ? ['-af', audioFilter] : []),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-metadata:s:v:0', 'rotate=0',
    '-movflags', '+faststart',
    outputPath,
  ]
}
