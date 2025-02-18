import { Client as MinioClient } from 'minio'

export interface StorageOptions {
  endpoint: string
  port: number
  accessKey: string
  secretKey: string
  bucket: string
}

export class RawStorage {
  private readonly client: MinioClient
  private readonly bucket: string
  private bucketEnsured = false

  constructor(opts: StorageOptions) {
    this.bucket = opts.bucket
    this.client = new MinioClient({
      endPoint: opts.endpoint,
      port: opts.port,
      useSSL: false,
      accessKey: opts.accessKey,
      secretKey: opts.secretKey,
    })
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) return
    try {
      const exists = await this.client.bucketExists(this.bucket)
      if (!exists) {
        await this.client.makeBucket(this.bucket)
      }
      this.bucketEnsured = true
    } catch (err) {
      throw new Error(`[storage] Failed to ensure bucket "${this.bucket}": ${String(err)}`)
    }
  }

  async save(key: string, data: unknown): Promise<void> {
    await this.ensureBucket()
    try {
      const json = JSON.stringify(data)
      const buf = Buffer.from(json, 'utf-8')
      await this.client.putObject(this.bucket, key, buf, buf.length, {
        'Content-Type': 'application/json',
      })
    } catch (err) {
      throw new Error(`[storage] Failed to save "${key}": ${String(err)}`)
    }
  }

  async load(key: string): Promise<unknown> {
    await this.ensureBucket()
    try {
      const stream = await this.client.getObject(this.bucket, key)
      const chunks: Buffer[] = []
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf-8'))
    } catch (err) {
      throw new Error(`[storage] Failed to load "${key}": ${String(err)}`)
    }
  }

  async exists(key: string): Promise<boolean> {
    await this.ensureBucket()
    try {
      await this.client.statObject(this.bucket, key)
      return true
    } catch {
      return false
    }
  }
}
