/**
 * Job Queue Service for Async Processing
 * Handles long-running optimization tasks to avoid Vercel timeouts
 */

import { PlanningResult } from '@shared/types';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  progress?: number; // 0-100
  result?: PlanningResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedCompletionTime?: Date;
}

class JobQueueService {
  private jobs: Map<string, Job> = new Map();
  private readonly JOB_RETENTION_MS = 3600000; // 1 hour

  /**
   * Create a new job
   */
  createJob(jobId: string): Job {
    const job: Job = {
      id: jobId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);

    // Clean up old jobs periodically
    this.cleanupOldJobs();

    return job;
  }

  /**
   * Update job status
   */
  updateJob(jobId: string, updates: Partial<Job>): Job | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    Object.assign(job, updates, { updatedAt: new Date() });
    this.jobs.set(jobId, job);

    return job;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): Job | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId: string, result: PlanningResult): Job | null {
    return this.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      result,
    });
  }

  /**
   * Mark job as failed
   */
  failJob(jobId: string, error: string): Job | null {
    return this.updateJob(jobId, {
      status: 'failed',
      error,
    });
  }

  /**
   * Update job progress
   */
  updateProgress(jobId: string, progress: number): Job | null {
    return this.updateJob(jobId, {
      status: 'processing',
      progress: Math.min(100, Math.max(0, progress)),
    });
  }

  /**
   * Clean up jobs older than retention period
   */
  private cleanupOldJobs() {
    const now = Date.now();
    for (const [jobId, job] of this.jobs.entries()) {
      const age = now - job.createdAt.getTime();
      if (age > this.JOB_RETENTION_MS) {
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Get all jobs (for monitoring/debugging)
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }
}

export const jobQueueService = new JobQueueService();
