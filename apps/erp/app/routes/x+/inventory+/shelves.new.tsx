import { assertIsPost, error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import type { ClientActionFunctionArgs } from "@remix-run/react";
import { useNavigate, useSearchParams } from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";
import { useUser } from "~/hooks";
import { ShelfForm, shelfValidator, upsertShelf } from "~/modules/inventory";
import { setCustomFields } from "~/utils/form";
import { getParams, path } from "~/utils/path";
import { getCompanyId, shelvesQuery } from "~/utils/react-query";

export async function loader({ request }: LoaderFunctionArgs) {
  await requirePermissions(request, {
    create: "inventory",
  });

  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    create: "inventory",
  });

  const formData = await request.formData();
  const modal = formData.get("type") === "modal";

  const validation = await validator(shelfValidator).validate(formData);

  if (validation.error) {
    return validationError(validation.error);
  }

  const { id, ...data } = validation.data;

  const createShelf = await upsertShelf(client, {
    ...data,
    companyId,
    customFields: setCustomFields(formData),
    createdBy: userId,
  });
  if (createShelf.error) {
    return json(
      {},
      await flash(request, error(createShelf.error, "Failed to insert shelf"))
    );
  }

  return modal
    ? json(createShelf, { status: 201 })
    : redirect(
        `${path.to.shelves}?${getParams(request)}`,
        await flash(request, success("Shelf created"))
      );
}

export async function clientAction({
  request,
  serverAction,
}: ClientActionFunctionArgs) {
  const companyId = getCompanyId();

  const formData = await request.clone().formData();
  const validation = await validator(shelfValidator).validate(formData);

  if (validation.error) {
    return validationError(validation.error);
  }

  if (companyId && validation.data.locationId) {
    window.clientCache?.setQueryData(
      shelvesQuery(companyId, validation.data.locationId).queryKey,
      null
    );
  }
  return await serverAction();
}

export default function NewShelfRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { defaults } = useUser();
  const locationId =
    (searchParams.get("location") || defaults.locationId) ?? "";

  const initialValues = {
    name: "",
    locationId,
  };

  return (
    <ShelfForm
      initialValues={initialValues}
      locationId={locationId}
      onClose={() => navigate(-1)}
    />
  );
}
