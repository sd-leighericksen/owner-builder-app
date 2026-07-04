import { apiHandler, json } from "@/lib/api/handler";
import { removeInsurance } from "@/lib/services/contacts";

export const DELETE = apiHandler<{ insuranceId: string }>(async ({ auth, params }) => {
  await removeInsurance(auth.accountId, params.insuranceId);
  return json({ ok: true });
});
