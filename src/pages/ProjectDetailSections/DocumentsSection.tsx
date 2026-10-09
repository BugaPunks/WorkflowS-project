import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import type { DocumentItem, DocumentVersion } from "./types";

export function DocumentsSection({ projectId }: { projectId: string }) {
	const [documents, setDocuments] = useState<DocumentItem[]>([]);
	const [uploading, setUploading] = useState(false);
	const [showHistory, setShowHistory] = useState<string | null>(null);
	const [historyData, setHistoryData] = useState<DocumentVersion[]>([]);
	const [showUploadModal, setShowUploadModal] = useState(false);
	const [uploadParentId, setUploadParentId] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const loadDocs = useCallback(async () => {
		try {
			const response = await fetch(`/api/documents/${projectId}`);
			if (response.ok) {
				const data = await response.json();
				setDocuments(data.data || []);
			}
		} catch (err) {
			console.error(err);
		}
	}, [projectId]);

	const loadHistory = async (docId: string) => {
		try {
			const response = await fetch(`/api/documents/${docId}/versions`);
			if (response.ok) {
				const data = await response.json();
				setHistoryData(data.data || []);
				setShowHistory(docId);
			}
		} catch (error) {
			console.error("Error loading history:", error);
		}
	};

	useEffect(() => {
		loadDocs();
	}, [loadDocs]);

	const openUploadModal = (parentId: string | null = null) => {
		setUploadParentId(parentId);
		setShowUploadModal(true);
	};

	const handleUploadSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const files = fileInputRef.current?.files;
		if (!files || files.length === 0) {
			alert("Por favor selecciona un archivo.");
			return;
		}

		const file = files[0];
		setUploading(true);

		try {
			const url = uploadParentId
				? `/api/documents/${uploadParentId}/versions`
				: `/api/documents/${projectId}`;

			const formData = new FormData();
			formData.append("file", file);

			const response = await fetch(url, {
				method: "POST",
				// headers: Content-Type is set automatically for FormData
				body: formData,
			});

			if (!response.ok) {
				const errorData = await response.json();
				alert(errorData.error || "Error al subir");
			} else {
				loadDocs();
				if (uploadParentId && showHistory === uploadParentId) {
					loadHistory(uploadParentId);
				}
				setShowUploadModal(false);
			}
		} catch (_err) {
			alert("Error al subir");
		} finally {
			setUploading(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("¿Eliminar archivo y todas sus versiones?")) return;
		try {
			await fetch(`/api/documents/${id}`, { method: "DELETE" });
			loadDocs();
			if (showHistory === id) setShowHistory(null);
		} catch (err) {
			console.error(err);
		}
	};

	return (
		<div className="bg-white rounded-lg shadow p-4 flex flex-col lg:flex-row gap-6">
			<div className="flex-1">
				<div className="flex justify-between items-center mb-4 border-b pb-2">
					<h3 className="font-bold text-lg text-gray-800">Documentos</h3>
					<button
						type="button"
						onClick={() => openUploadModal(null)}
						disabled={uploading}
						className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-900 px-4 py-2 rounded font-medium transition-colors"
					>
						+ Subir Archivo
					</button>
				</div>

				{documents.length === 0 ? (
					<div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
						<div className="text-4xl mb-2">📂</div>
						<p>No hay documentos compartidos.</p>
						<p className="text-xs mt-1">
							Usa el botón de arriba para subir archivos.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{documents.map((doc) => (
							<div
								key={doc.id}
								className={`border rounded-lg p-4 flex flex-col transition-shadow bg-white ${showHistory === doc.id ? "ring-2 ring-blue-700" : "hover:shadow-md"}`}
							>
								<div className="flex justify-between items-start mb-2">
									<div className="flex gap-2">
										<span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded uppercase">
											{doc.type}
										</span>
										{doc.latestVersion && doc.latestVersion > 1 && (
											<span className="bg-blue-100 text-blue-900 text-xs font-bold px-2 py-1 rounded">
												V{doc.latestVersion}
											</span>
										)}
									</div>
									<button
										type="button"
										onClick={() => handleDelete(doc.id)}
										className="text-red-400 hover:text-red-600"
									>
										×
									</button>
								</div>
								<p className="font-medium text-gray-800 truncate mb-1">
									{doc.name}
								</p>
								<p className="text-xs text-gray-500 mb-3">
									{(doc.size / 1024).toFixed(1)} KB •{" "}
									{new Date(doc.uploadedAt).toLocaleDateString()}
								</p>

								<div className="mt-auto flex flex-col gap-2">
									<div className="flex gap-2">
										<a
											href={doc.url}
											target="_blank"
											rel="noopener noreferrer"
											className="flex-1 text-center block bg-gray-50 hover:bg-gray-100 text-blue-950 text-sm py-2 rounded"
										>
											Descargar
										</a>
										{doc.versionCount && doc.versionCount > 1 && (
											<button
												type="button"
												onClick={() => loadHistory(doc.id)}
												className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm py-2 rounded"
											>
												Historial
											</button>
										)}
									</div>
									<button
										type="button"
										onClick={() => openUploadModal(doc.id)}
										className="w-full text-center text-xs text-blue-950 hover:text-blue-800 border border-dashed border-blue-200 hover:border-blue-400 rounded py-1"
									>
										+ Nueva Versión
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Version History Panel */}
			{showHistory && (
				<div className="w-full lg:w-80 border-l pl-6 animate-fade-in">
					<div className="flex justify-between items-center mb-4 border-b pb-2">
						<h3 className="font-bold text-gray-800">Historial de Versiones</h3>
						<button
							type="button"
							onClick={() => setShowHistory(null)}
							className="text-gray-400 hover:text-gray-600"
						>
							×
						</button>
					</div>
					<div className="space-y-3">
						{historyData.map((ver) => (
							<div
								key={ver.id}
								className="p-3 bg-gray-50 rounded border border-gray-100"
							>
								<div className="flex justify-between items-center mb-1">
									<span className="font-bold text-sm text-blue-800">
										Versión {ver.version}
									</span>
									<span className="text-xs text-gray-500">
										{new Date(ver.uploadedAt).toLocaleDateString()}
									</span>
								</div>
								<a
									href={ver.url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-xs text-blue-950 hover:underline block mt-1"
								>
									Descargar Archivo
								</a>
							</div>
						))}
					</div>
				</div>
			)}

			<Modal
				isOpen={showUploadModal}
				onClose={() => setShowUploadModal(false)}
				title={uploadParentId ? "Subir Nueva Versión" : "Subir Nuevo Documento"}
			>
				<form onSubmit={handleUploadSubmit}>
					<div className="mb-4">
						<label
							htmlFor="file-upload"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Selecciona un archivo
						</label>
						<input
							id="file-upload"
							type="file"
							ref={fileInputRef}
							className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-900
                hover:file:bg-blue-100"
							required
						/>
						{uploadParentId && (
							<p className="mt-2 text-xs text-gray-500">
								Este archivo se guardará como la versión más reciente del
								documento seleccionado.
							</p>
						)}
						{!uploadParentId && (
							<p className="mt-2 text-xs text-gray-500">
								Este archivo se subirá como un nuevo documento en el proyecto.
							</p>
						)}
					</div>
					<div className="flex gap-3 justify-end">
						<button
							type="button"
							onClick={() => setShowUploadModal(false)}
							className="px-4 py-2 bg-gray-100 rounded text-gray-700 hover:bg-gray-200"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={uploading}
							className="px-4 py-2 bg-blue-950 text-white rounded hover:bg-blue-900"
						>
							{uploading ? "Subiendo..." : "Subir"}
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
