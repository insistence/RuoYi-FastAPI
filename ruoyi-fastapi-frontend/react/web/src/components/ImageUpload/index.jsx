import FileUpload from "@/components/FileUpload";
export default function ImageUpload(props) {
  return <FileUpload fileType={["png", "jpg", "jpeg"]} {...props} image />;
}
