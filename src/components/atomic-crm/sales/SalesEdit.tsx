import { useMutation } from "@tanstack/react-query";
import {
  useDataProvider,
  useEditController,
  useNotify,
  useRecordContext,
  useRedirect,
  useTranslate,
} from "ra-core";
import type { SubmitHandler } from "react-hook-form";
import { SimpleForm } from "@/components/admin/simple-form";
import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";
import { Card, CardContent } from "@/components/ui/card";

import type { CrmDataProvider } from "../providers/types";
import type { Sale, SalesFormData } from "../types";
import { SalesInputs } from "./SalesInputs";
// LAGO Brief 42-korrektur (16. sep 2026): "Send adgangskode-link"
// erstatter det tidligere "Send invitation"-flow. Brugere oprettes
// direkte med email_confirm=true, så invitation-endepunktet fejler
// mod dem — recovery-link er den ene sti der virker for både nye og
// tilbagevendende brugere.
import { SendPasswordLinkButton } from "@/lago/settings/SendPasswordLinkButton";
// LAGO Brief 27: "Log ind som"-knap (admin-only) ved siden af Send
// invitation. Bevidst placeret her — brief §6: "Ikke i en menu, hvor
// den kan rammes ved et uheld."
import { ImpersonateButton } from "@/lago/impersonation/ImpersonateButton";

function EditToolbar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap gap-2">
        <SendPasswordLinkButton />
        <ImpersonateButton />
      </div>
      <div className="flex gap-4">
        <CancelButton />
        <SaveButton />
      </div>
    </div>
  );
}

export function SalesEdit() {
  const { record } = useEditController();

  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const redirect = useRedirect();
  const translate = useTranslate();

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      if (!record) {
        throw new Error(
          translate("resources.sales.edit.record_not_found", {
            _: "Record not found",
          }),
        );
      }
      return dataProvider.salesUpdate(record.id, data);
    },
    onSuccess: () => {
      redirect("/sales");
      notify("resources.sales.edit.success", {
        messageArgs: {
          _: "User updated successfully",
        },
      });
    },
    onError: () => {
      notify("resources.sales.edit.error", {
        type: "error",
        messageArgs: {
          _: "An error occurred. Please try again.",
        },
      });
    },
  });

  const onSubmit: SubmitHandler<SalesFormData> = async (data) => {
    mutate(data);
  };

  return (
    <div className="max-w-lg w-full mx-auto mt-8">
      <Card>
        <CardContent>
          <SimpleForm
            toolbar={<EditToolbar />}
            onSubmit={onSubmit as SubmitHandler<any>}
            record={record}
          >
            <SaleEditTitle />
            <SalesInputs />
          </SimpleForm>
        </CardContent>
      </Card>
    </div>
  );
}

const SaleEditTitle = () => {
  const record = useRecordContext<Sale>();
  const translate = useTranslate();
  if (!record) return null;
  return (
    <h2 className="text-lg font-semibold mb-4">
      {translate("resources.sales.edit.title", {
        name: `${record.first_name} ${record.last_name}`,
      })}
    </h2>
  );
};
