import { supabase } from '../database/supabase';
import fs from 'fs';
import path from 'path';

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'invoice-pdfs';

export class StorageService {
  /**
   * Upload a PDF file to Supabase Storage
   */
  static async uploadPDF(filePath: string, fileName: string): Promise<string> {
    try {
      // Read the file
      const fileBuffer = fs.readFileSync(filePath);
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true // Replace if exists
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('PDF upload error:', error);
      throw error;
    }
  }

  /**
   * Get a signed URL for a PDF file (for private access)
   */
  static async getSignedUrl(fileName: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(fileName, expiresIn);

      if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Signed URL error:', error);
      throw error;
    }
  }

  /**
   * Delete a PDF file from storage
   */
  static async deletePDF(fileName: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([fileName]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }
    } catch (error) {
      console.error('PDF delete error:', error);
      throw error;
    }
  }

  /**
   * List all PDF files for a user
   */
  static async listUserPDFs(userId: number): Promise<string[]> {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', {
          search: `${userId}_`
        });

      if (error) {
        throw new Error(`List failed: ${error.message}`);
      }

      return data.map(file => file.name);
    } catch (error) {
      console.error('List PDFs error:', error);
      throw error;
    }
  }

  /**
   * Generate a unique filename for a PDF
   */
  static generateFileName(userId: number, invoiceNumber: string): string {
    const timestamp = Date.now();
    return `${userId}_invoice_${invoiceNumber}_${timestamp}.pdf`;
  }

  /**
   * Check if storage bucket exists and is accessible
   */
  static async checkBucket(): Promise<boolean> {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', { limit: 1 });

      return !error;
    } catch (error) {
      console.error('Bucket check error:', error);
      return false;
    }
  }
}

export default StorageService;