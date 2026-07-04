import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { insuranceCreate } from "@/lib/validation/schemas";
import { addInsurance } from "@/lib/services/contacts";

export const POST = apiHandler<{ contactId: string }>(async ({ request, auth, params }) => {
  const input = await parseBody(request, insuranceCreate);
  return json(await addInsurance(auth.accountId, auth.userId, params.contactId, input), { status: 201 });
});
