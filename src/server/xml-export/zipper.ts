import "server-only";

import { PassThrough } from "node:stream";

import archiver from "archiver";

export type ZipFile = {
  /** Relative path inside the zip (e.g. "IT04049550041_2026_0001.xml"). */
  name: string;
  /** UTF-8 string contents. */
  content: string;
};

/**
 * Bundle a list of in-memory files into a single zip buffer.
 *
 * We use `archiver` because it streams gracefully (we still buffer the
 * whole archive here because Supabase Storage's upload API takes a
 * `Buffer`/`Blob`, but the streaming consumer pattern keeps memory
 * pressure low for hundreds of small XMLs). The zip is uncompressed-
 * deflate level 9 because the XML payloads are highly redundant and
 * compress very well.
 *
 * The archive uses UTF-8 filenames (Info-ZIP Unicode extra field) so
 * accented characters in filenames decode correctly on macOS / Windows.
 */
export async function buildZip(files: ZipFile[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk));
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);
    archive.on("warning", (err) => {
      // ENOENT for in-memory archives is benign; surface anything else.
      if (
        typeof err === "object" &&
        err &&
        "code" in err &&
        (err as { code: string }).code === "ENOENT"
      ) {
        return;
      }
      reject(err);
    });
    archive.on("error", reject);
    archive.pipe(output);

    for (const file of files) {
      archive.append(file.content, { name: file.name });
    }

    archive.finalize().catch(reject);
  });
}
