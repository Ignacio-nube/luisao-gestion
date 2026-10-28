import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"
import { meQueryKey } from "@/lib/auth"
import type { AuthUser } from "@/lib/types"

/** Formulario para que el usuario logueado cambie su propia contraseña. */
export function OwnPasswordForm({ onDone }: { onDone?: () => void }) {
  const queryClient = useQueryClient()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")

  const mismatch = confirm.length > 0 && next !== confirm
  const tooShort = next.length > 0 && next.length < 6

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ user: AuthUser }>("/auth/change-password", {
        currentPassword: current,
        newPassword: next,
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(meQueryKey, user)
      toast.success("Contraseña actualizada")
      setCurrent("")
      setNext("")
      setConfirm("")
      onDone?.()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mismatch || tooShort) return
    mutation.mutate()
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="current-password">Contraseña actual</FieldLabel>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field data-invalid={tooShort || undefined}>
          <FieldLabel htmlFor="new-password">Nueva contraseña</FieldLabel>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={tooShort || undefined}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          {tooShort ? (
            <FieldError>Mínimo 6 caracteres.</FieldError>
          ) : (
            <FieldDescription>Mínimo 6 caracteres. Al cambiarla se cierran tus otras sesiones.</FieldDescription>
          )}
        </Field>
        <Field data-invalid={mismatch || undefined}>
          <FieldLabel htmlFor="confirm-password">Repetir nueva contraseña</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={mismatch || undefined}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && <FieldError>Las contraseñas no coinciden.</FieldError>}
        </Field>
        <Field orientation="horizontal">
          <Button type="submit" disabled={mutation.isPending || mismatch || tooShort}>
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            Guardar contraseña
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
