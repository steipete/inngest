import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InngestClient } from "../api/client.js";

vi.mock("axios");
const mockedAxios = vi.mocked(axios);

describe("InngestClient", () => {
  let client: InngestClient;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as ReturnType<typeof axios.create>);

    client = new InngestClient({
      signingKey: "test-signing-key",
      baseUrl: "https://api.test.com",
    });
  });

  describe("constructor", () => {
    it("should create axios instance with correct config", () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "https://api.test.com",
        headers: {
          Authorization: "Bearer test-signing-key",
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });
    });

    it("should use default base URL when not provided", () => {
      new InngestClient({
        signingKey: "test-key",
      });

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "https://api.inngest.com",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });
    });

    it("should throw error for invalid config", () => {
      expect(() => {
        new InngestClient({
          signingKey: "",
        });
      }).toThrow();
    });

    it("should throw error for invalid base URL", () => {
      expect(() => {
        new InngestClient({
          signingKey: "test-key",
          baseUrl: "not-a-url",
        });
      }).toThrow();
    });
  });

  describe("getRun", () => {
    it("should fetch and validate run data", async () => {
      const mockRun = {
        run_id: "01HWAVJ8ASQ5C3FXV32JS9DV9Q",
        status: "Completed",
        run_started_at: "2024-04-25T14:46:45.337Z",
        ended_at: "2024-04-25T14:46:46.896Z",
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue({ data: { data: mockRun } });

      const result = await client.getRun("01HWAVJ8ASQ5C3FXV32JS9DV9Q");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/runs/01HWAVJ8ASQ5C3FXV32JS9DV9Q");
      expect(result).toEqual(mockRun);
    });

    it("should throw error for invalid response data", async () => {
      const invalidRun = {
        run_id: "",
        status: "InvalidStatus",
        run_started_at: "invalid-date",
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue({ data: invalidRun });

      await expect(client.getRun("01HWAVJ8ASQ5C3FXV32JS9DV9Q")).rejects.toThrow(
        /API Response validation failed/,
      );
    });
  });

  describe("findRunByPartialId", () => {
    it("should find run by full ID when provided", async () => {
      const mockRun = {
        run_id: "01HWAVJ8ASQ5C3FXV32JS9DV9Q",
        status: "Completed",
        run_started_at: "2024-04-25T14:46:45.337Z",
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue({ data: { data: mockRun } });

      const result = await client.findRunByPartialId("01HWAVJ8ASQ5C3FXV32JS9DV9Q");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/runs/01HWAVJ8ASQ5C3FXV32JS9DV9Q");
      expect(result).toEqual(mockRun);
    });

    it("should search event runs for a partial ID match", async () => {
      const eventId = "01HWAVEB858VPPX47Z65GR6P6R";
      const mockEventsResponse = {
        data: [
          {
            internal_id: eventId,
            name: "test.event",
            data: { userId: "123" },
          },
          {
            internal_id: "01HWAVEB858VPPX47Z65OTHER1",
            name: "other.event",
            data: { run_id: "01HWAVJ8ASQ5C3FXV32ABCDEFG" },
          },
        ],
      };

      const mockRunResponse = {
        run_id: "01HWAVJ8ASQ5C3FXV32JS9DV9Q",
        status: "Completed",
        run_started_at: "2024-04-25T14:46:45.337Z",
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get)
        .mockResolvedValueOnce({ data: mockEventsResponse })
        .mockResolvedValueOnce({ data: { data: [mockRunResponse] } });

      const result = await client.findRunByPartialId("JS9DV9Q");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/events?limit=200");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/v1/events/${eventId}/runs`);
      expect(mockAxiosInstance.get).not.toHaveBeenCalledWith("/v1/runs/01HWAVJ8ASQ5C3FXV32JS9DV9Q");
      expect(result).toEqual(mockRunResponse);
    });

    it("does not treat the sender payload run_id as the function run", async () => {
      const eventId = "01HWAVEB858VPPX47Z65GR6P6R";
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get)
        .mockResolvedValueOnce({
          data: {
            data: [
              {
                internal_id: eventId,
                name: "test.event",
                data: { run_id: "01HWAVJ8ASQ5C3FXV32JS9DV9Q" },
              },
            ],
          },
        })
        .mockResolvedValueOnce({ data: { data: [] } });

      const result = await client.findRunByPartialId("JS9DV9Q");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/v1/events/${eventId}/runs`);
      expect(mockAxiosInstance.get).not.toHaveBeenCalledWith("/v1/runs/01HWAVJ8ASQ5C3FXV32JS9DV9Q");
      expect(result).toBeNull();
    });

    it("should return null when partial ID not found", async () => {
      const mockEventsResponse = {
        data: [
          {
            name: "test.event",
            data: { run_id: "01HWAVJ8ASQ5C3FXV32JS9DV9Q" },
          },
        ],
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue({ data: mockEventsResponse });

      const result = await client.findRunByPartialId("NOTFOUND");

      expect(result).toBeNull();
    });

    it("should return null when events fetch fails", async () => {
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockRejectedValue(new Error("Network error"));

      const result = await client.findRunByPartialId("JS9DV9Q");

      expect(result).toBeNull();
    });

    it("should return null when full ID lookup fails", async () => {
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockRejectedValue(new Error("Not found"));

      const result = await client.findRunByPartialId("01HWAVJ8ASQ5C3FXV32JS9DV9Q");

      expect(result).toBeNull();
    });

    it("should continue searching when one event run lookup fails", async () => {
      const mockEventsResponse = {
        data: [
          {
            internal_id: "01HWAVEB858VPPX47Z65TEST01",
            name: "test.event",
            data: { note: "first" },
          },
          {
            internal_id: "01HWAVEB858VPPX47Z65MATCH1",
            name: "other.event",
            data: { note: "second" },
          },
        ],
      };

      const mockRunResponse = {
        run_id: "01HWAVJ8ASQ5C3FXV32MATCHME",
        status: "Failed",
        run_started_at: "2024-04-25T14:46:45.337Z",
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get)
        .mockResolvedValueOnce({ data: mockEventsResponse })
        .mockRejectedValueOnce(new Error("First event runs failed"))
        .mockResolvedValueOnce({ data: { data: [mockRunResponse] } });

      const result = await client.findRunByPartialId("ME");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/events?limit=200");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/events/01HWAVEB858VPPX47Z65TEST01/runs",
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/events/01HWAVEB858VPPX47Z65MATCH1/runs",
      );
      expect(result).toEqual(mockRunResponse);
    });
  });

  describe("listRuns", () => {
    it("should list runs with default options", async () => {
      const eventId = "01HWAVEB858VPPX47Z65GR6P6R";
      const mockEventsResponse = {
        data: [
          {
            internal_id: eventId,
            name: "test.event",
            data: { run_id: "not-a-function-run" },
          },
        ],
      };

      const mockRun = {
        run_id: "01HWAVJ8ASQ5C3FXV32JS9DV9Q",
        status: "Completed" as const,
        run_started_at: "2024-04-25T14:46:45.337Z",
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get)
        .mockResolvedValueOnce({ data: mockEventsResponse })
        .mockResolvedValueOnce({ data: { data: [mockRun] } });

      const result = await client.listRuns();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/events?limit=50");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/v1/events/${eventId}/runs`);
      expect(mockAxiosInstance.get).not.toHaveBeenCalledWith("/v1/runs/not-a-function-run");
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(mockRun);
      expect(result.has_more).toBe(false);
    });

    it("returns the last event id when the event page is full", async () => {
      const eventId = "01HWAVEB858VPPX47Z65GR6P6R";
      const mockRun = {
        run_id: "01HWAVJ8ASQ5C3FXV32JS9DV9Q",
        status: "Running" as const,
        run_started_at: "2024-04-25T14:46:45.337Z",
        ended_at: null,
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get)
        .mockResolvedValueOnce({
          data: {
            data: [
              {
                internal_id: eventId,
                name: "test.event",
                data: { hello: "world" },
              },
            ],
          },
        })
        .mockResolvedValueOnce({ data: { data: [mockRun] } });

      const result = await client.listRuns({ limit: 1 });

      expect(result.has_more).toBe(true);
      expect(result.cursor).toBe(eventId);
      expect(result.data[0]?.ended_at).toBeUndefined();
    });

    it("should list runs with filters", async () => {
      const mockResponse = {
        data: [],
        has_more: false,
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue({ data: mockResponse });

      const result = await client.listRuns({
        status: "Running",
        function_id: "test-function",
        cursor: "test-cursor",
        limit: 50,
      });

      // When status is provided, it now includes event limit (100) and time range
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/events\?limit=100&cursor=test-cursor&received_after=/),
      );
      expect(result.data).toHaveLength(0);
    });
  });

  describe("bulkCancel", () => {
    it("should validate request and response", async () => {
      const validRequest = {
        app_id: "my-app",
        function_id: "test-function",
        started_after: "2024-01-01T00:00:00Z",
      };

      const mockResponse = {
        cancellation_id: "01HWAVJ8ASQ5C3FXV32JS9DV9Q",
        status: "pending",
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.post).mockResolvedValue({ data: mockResponse });

      const result = await client.bulkCancel(validRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/cancellations", validRequest);
      expect(result).toEqual(mockResponse);
    });

    it("should throw error for invalid request", async () => {
      const invalidRequest = {
        started_after: "invalid-date",
      };

      await expect(client.bulkCancel(invalidRequest)).rejects.toThrow();
    });
  });

  describe("cancelRun", () => {
    it("should delete run", async () => {
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.delete).mockResolvedValue({ data: {} });

      await client.cancelRun("01HWAVJ8ASQ5C3FXV32JS9DV9Q");

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/v1/runs/01HWAVJ8ASQ5C3FXV32JS9DV9Q");
    });
  });

  describe("getEvent", () => {
    it("should fetch and validate event data", async () => {
      const mockEvent = {
        id: "01HWAVEB858VPPX47Z65GR6P6R",
        name: "test.event",
        data: { userId: "123", action: "payment" },
        ts: 1640995200000,
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue({ data: { data: mockEvent } });

      const result = await client.getEvent("01HWAVEB858VPPX47Z65GR6P6R");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/events/01HWAVEB858VPPX47Z65GR6P6R");
      expect(result).toEqual(mockEvent);
    });

    it("should return null when event not found", async () => {
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockRejectedValue(new Error("Not found"));

      const result = await client.getEvent("01HWAVEB858VPPX47Z65GR6P6R");

      expect(result).toBeNull();
    });
  });

  describe("getJobs", () => {
    it("accepts the queue payload from the runs jobs endpoint", async () => {
      const runId = "01HWAVJ8ASQ5C3FXV32JS9DV9Q";
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue({
        data: {
          data: [
            {
              JobID: "01HWAVJ8ASQ5C3FXV32JOB0001",
              at: "2024-04-25T14:46:45.337Z",
              position: 2,
              kind: "start",
              attempt: 1,
            },
          ],
        },
      });

      const result = await client.getJobs(runId);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/v1/runs/${runId}/jobs`);
      expect(result).toEqual([
        {
          id: "01HWAVJ8ASQ5C3FXV32JOB0001",
          run_id: runId,
          step: "start",
          status: "Queued",
          started_at: "2024-04-25T14:46:45.337Z",
        },
      ]);
    });
  });

  describe("getCancellationStatus", () => {
    it("selects the cancellation from the list endpoint", async () => {
      const cancellationId = "01HWAVJ8ASQ5C3FXV32JS9DV9Q";
      const mockStatus = {
        id: cancellationId,
        status: "completed",
        cancelled_count: 5,
        created_at: "2024-04-25T14:46:45.337Z",
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue({
        data: {
          data: [{ id: "01HWAVJ8ASQ5C3FXV32OTHER01", status: "pending" }, mockStatus],
        },
      });

      const result = await client.getCancellationStatus(cancellationId);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/cancellations");
      expect(mockAxiosInstance.get).not.toHaveBeenCalledWith(`/v1/cancellations/${cancellationId}`);
      expect(result).toEqual(mockStatus);
    });
  });
});
