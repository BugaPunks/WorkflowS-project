import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLogoIcon } from "@/components/AppLogoIcon";
import { useSession } from "@/hooks/useSession";

interface LoginFormData {
	email: string;
	password: string;
}

const STAGES = ["Backlog", "Sprint", "Revisión", "Entrega"];

export function LoginForm() {
	const navigate = useNavigate();
	const { login } = useSession();
	const [formData, setFormData] = useState<LoginFormData>({
		email: "",
		password: "",
	});
	const [errors, setErrors] = useState<
		Partial<Record<keyof LoginFormData, string>>
	>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.currentTarget;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));

		// Limpiar errores cuando el usuario edita
		if (errors[name as keyof LoginFormData]) {
			setErrors((prev) => ({
				...prev,
				[name]: undefined,
			}));
		}
	};

	const validate = (): boolean => {
		const newErrors: Partial<Record<keyof LoginFormData, string>> = {};

		if (!formData.email) {
			newErrors.email = "El email es requerido";
		} else if (!/\S+@\S+\.\S+/.test(formData.email)) {
			newErrors.email = "El email no es válido";
		}

		if (!formData.password) {
			newErrors.password = "La contraseña es requerida";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setSubmitError(null);

		if (!validate()) {
			return;
		}

		setIsSubmitting(true);

		try {
			// Using /api prefix to use proxy
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Error al iniciar sesión");
			}

			// Update session state (el token viaja en la cookie HttpOnly)
			login({
				id: data.user.id,
				name: data.user.name,
				email: data.user.email,
				role: data.user.role,
				password: "", // Not needed in session
			});

			// Redirigir directamente al dashboard (Proyectos)
			navigate("/");
		} catch (error) {
			setSubmitError(
				error instanceof Error ? error.message : "Error desconocido",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-white font-sans flex">
			{/* Lado izq: marca */}
			<aside className="hidden lg:flex w-[46%] bg-linear-to-br from-indigo-950 via-indigo-900 to-indigo-700 text-white flex-col justify-between p-12">
				<div className="flex items-center gap-3">
					<div className="bg-white/15 backdrop-blur flex size-10 items-center justify-center rounded-xl">
						<AppLogoIcon className="size-6 fill-current text-white" />
					</div>
					<span className="text-lg font-semibold tracking-tight">
						WorkflowS
					</span>
				</div>

				<div>
					<h1 className="text-4xl font-bold leading-tight tracking-tight">
						Todo tu trabajo ágil
						<br />
						en un solo flujo.
					</h1>
					<p className="mt-4 max-w-xs text-base font-light text-indigo-200">
						De la idea al entregable: sprints, historias y entregas, siempre en
						movimiento.
					</p>

					{/* Pipeline */}
					<div
						className="mt-10 flex items-center gap-0"
						role="img"
						aria-label="Flujo de trabajo ágil: Backlog, Sprint, Revisión y Entrega"
					>
						{STAGES.map((stage, i) => (
							<div key={stage} className="flex items-center">
								<div
									className="workflowpulse group flex flex-col items-center gap-1.5 px-3"
									style={{ animationDelay: `${i * 0.7}s` }}
								>
									<div className="flex items-center gap-1.5">
										<i className="block size-2.5 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
										<i className="block size-2.5 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
									</div>
									<span className="text-[10px] font-medium tracking-wide text-indigo-200">
										{stage}
									</span>
								</div>
								{i < STAGES.length - 1 && (
									<i
										className="block h-px w-8 bg-white/30"
										aria-hidden="true"
									/>
								)}
							</div>
						))}
					</div>
				</div>

				<p className="text-sm font-light text-indigo-300">
					© {new Date().getFullYear()} WorkflowS
				</p>
			</aside>

			{/* Lado der: formulario */}
			<main className="flex flex-1 items-center justify-center p-6">
				<div className="w-full max-w-sm">
					<div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
						<div className="bg-blue-600 text-white flex size-9 items-center justify-center rounded-lg">
							<AppLogoIcon className="size-5 fill-current" />
						</div>
						<span className="text-lg font-semibold tracking-tight text-slate-900">
							WorkflowS
						</span>
					</div>

					<h2 className="text-3xl font-bold tracking-tight text-slate-900">
						Iniciar sesión
					</h2>
					<p className="mt-1.5 text-sm text-slate-500">
						Bienvenido de nuevo. Ingresa tus credenciales para continuar.
					</p>

					<form onSubmit={handleSubmit} className="mt-8 space-y-5">
						{submitError && (
							<div
								className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
								role="alert"
							>
								{submitError}
							</div>
						)}

						<div>
							<label
								className="mb-1.5 block text-sm font-medium text-slate-700"
								htmlFor="email"
							>
								Correo electrónico
							</label>
							<input
								className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
									errors.email
										? "border-red-300 focus:ring-red-500"
										: "border-slate-300 focus:ring-indigo-500"
								}`}
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								placeholder="tu@email.com"
								value={formData.email}
								onChange={handleChange}
							/>
							{errors.email && (
								<p className="mt-1.5 text-xs text-red-600">{errors.email}</p>
							)}
						</div>

						<div>
							<label
								className="mb-1.5 block text-sm font-medium text-slate-700"
								htmlFor="password"
							>
								Contraseña
							</label>
							<input
								className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
									errors.password
										? "border-red-300 focus:ring-red-500"
										: "border-slate-300 focus:ring-indigo-500"
								}`}
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								placeholder="••••••••"
								value={formData.password}
								onChange={handleChange}
							/>
							{errors.password && (
								<p className="mt-1.5 text-xs text-red-600">{errors.password}</p>
							)}
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							className={`flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
								isSubmitting ? "cursor-not-allowed opacity-60" : ""
							}`}
						>
							{isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}
						</button>
					</form>

					<p className="mt-6 text-center text-sm text-slate-600">
						¿No tienes cuenta?{" "}
						<a
							href="/register"
							className="font-semibold text-indigo-600 transition hover:text-indigo-700"
						>
							Regístrate aquí
						</a>
					</p>
				</div>
			</main>
		</div>
	);
}
