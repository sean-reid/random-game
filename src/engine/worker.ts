import { recommend } from "./recommend";
import type { RolloutReply, RolloutRequest } from "./types";

self.addEventListener("message", (e: MessageEvent<RolloutRequest>) => {
  const { seq, board, after, mix, prefer } = e.data;
  const reply: RolloutReply = { seq, result: recommend(board, after, mix, prefer) };
  postMessage(reply);
});
